import { query, transaction, executeInTransaction } from "../../config/db";
import { getRecord } from "../../utils/extra";
import { AppError } from "../../utils/AppError";
import {
  AddNewFirm,
  CountResult,
  CreateVendorParams,
  DeleteVendorParams,
  EditVendorParams,
  FetchDbVendor,
  FetchVendorParams,
  RemoveFirmVendorParams
} from "./vendor.types";
import { PoolClient } from "pg";
import { buildAuditChanges } from "../journal/journal.utils";

export default class VendorService {

  async createVendor(data: CreateVendorParams, client: PoolClient) {

    const {
      company_id,
      vendor_name,
      email,
      phone_number,
      alternate_phone,
      address,
      gstin,
      pan,
      state_code,
      statusCode,
      remark,
      firm_id,
      branch_id
    } = data;
    if (firm_id && !branch_id) {
      for (const firmId of firm_id) {
        const firmExist = await getRecord(firmId, "firm", "id", firmId, client);

        if (!firmExist) {
          throw new AppError("Firm not found", 404);
        }

        const firmBranchId = firmExist.branch_id;

        const branchExist = await getRecord(
          firmBranchId,
          "branches",
          "company_id",
          company_id,
          client
        );

        if (!branchExist) {
          throw new AppError(
            `${firmExist.firm_name} does not belong to this company`,
            404
          );
        }
      }
    }
    if (firm_id && branch_id) {
      for (const firmId of firm_id) {
        const firmExist = await getRecord(
          firmId,
          "firm",
          "id",
          firmId,
          client
        );

        if (!firmExist || Number(firmExist.branch_id) !== Number(branch_id)) {
          throw new AppError(`Firm ${firmId} does not belong to this branch`, 404);
        }
      }
    }

    const queryText = `
      INSERT INTO vendors (
        vendor_name,
        email,
        phone_number,
        alternate_phone,
        address,
        gstin,
        pan,
        state_code,
        status,
        remarks,
        firms,
        company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
      `;

    const values = [
      vendor_name,
      email,
      phone_number,
      alternate_phone,
      address,
      gstin,
      pan,
      state_code,
      statusCode,
      JSON.stringify(remark),
      firm_id ? firm_id : null,
      company_id
    ];
    const { rows } = await executeInTransaction(client, queryText, values);

    return {
      data: rows[0],
      message: `${rows[0].vendor_name} created`
    };
  }

  async fetchVendor(data: FetchVendorParams) {

    const { filters = {} } = data;

    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`v.status != $${values.length + 1}`);
    values.push(0);

    if (filters.search) {

      values.push(`%${filters.search}%`);
      const index = values.length;

      where.push(`
      (
        v.vendor_name ILIKE $${index}
        OR v.phone_number ILIKE $${index}
        OR v.email ILIKE $${index}
        OR v.gstin ILIKE $${index}
        OR v.pan ILIKE $${index}
      )
      `);
    }

    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`v.company_id = $${values.length}`);
    }
    if (filters.id) {
      values.push(filters.id);
      where.push(`v.id = $${values.length}`);
    }
    if (filters.firm_id) {
      values.push(filters.firm_id);
      where.push(`$${values.length} = ANY(v.firms)`);
    }
    if (filters.gstin) {
      values.push(filters.gstin);
      where.push(`v.gstin = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const vendorQuery = `
SELECT 
  v.*,
  ARRAY_REMOVE(ARRAY_AGG(b.firm_name), NULL) AS firm_names
FROM vendors v
LEFT JOIN firm b 
  ON b.id = ANY(v.firms)
${whereClause}
GROUP BY v.id
ORDER BY v.vendor_name
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
`;

    const countQuery = `
SELECT COUNT(*) 
FROM vendors v
${whereClause}
`;

    const vendors = await query<FetchDbVendor>(
      vendorQuery,
      [...values, limit, offset]
    );

    const total = await query<CountResult>(countQuery, values);

    return {
      vendors,
      page,
      limit,
      total: Number(total[0].count)
    };
  }

  async updateVendor(data: EditVendorParams, client: PoolClient) {

    const {
      id,
      company_id,
      vendor_name,
      email,
      phone_number,
      alternate_phone,
      address,
      gstin,
      pan,
      state_code,
      statusCode,
      remark
    } = data;


    const vendor = await getRecord(id, "vendors", "company_id", company_id, client);

    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }

    const queryText = `
      UPDATE vendors
      SET
        vendor_name = $1,
        email = $2,
        phone_number = $3,
        alternate_phone = $4,
        address = $5,
        gstin = $6,
        pan = $7,
        state_code = $8,
        status = $9,
        remarks =
        CASE
          WHEN remarks IS NULL THEN $10::jsonb
          WHEN jsonb_typeof(remarks)='array'
            THEN remarks || $10::jsonb
          ELSE jsonb_build_array(remarks) || $10::jsonb
        END
      WHERE id = $11
      RETURNING *;
      `;

    const values = [
      vendor_name ?? vendor.vendor_name,
      email ?? vendor.email,
      phone_number ?? vendor.phone_number,
      alternate_phone ?? vendor.alternate_phone,
      address ?? vendor.address,
      gstin ?? vendor.gstin,
      pan ?? vendor.pan,
      state_code ?? vendor.state_code,
      statusCode ?? vendor.status,
      JSON.stringify(remark),
      id
    ];

    const { rows } = await executeInTransaction(client, queryText, values);
    const changes = buildAuditChanges(vendor, rows[0]);
    return { changes, data: rows[0] };

  }
  async addVendorNewFirm(data: AddNewFirm, remark: object, client: PoolClient) {

    const {
      vendor_id,
      firm_id,
      company_id
    } = data;


    const vendor = await getRecord(vendor_id, "vendors", "company_id", company_id, client);

    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }

    const queryText = `
        UPDATE vendors
        SET
        firms =
        CASE
          WHEN NOT ($1 = ANY(firms))
          THEN array_append(firms, $1)
          ELSE firms
        END,

          remarks =
          CASE
            WHEN remarks IS NULL THEN $2::jsonb
            WHEN jsonb_typeof(remarks)='array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END

        WHERE id = $3
        RETURNING *;
      `;

    const values = [
      Number(firm_id),
      JSON.stringify(remark),
      vendor_id
    ];

    const { rows } = await executeInTransaction(client, queryText, values);

    return rows[0];

  }

  async deleteVendor(data: DeleteVendorParams, client: PoolClient) {

    const { r_id, remark, company_id } = data;


    const vendor = await getRecord(r_id, "vendors", "company_id", company_id, client);

    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }
    const queryText = `
      UPDATE vendors
      SET
        status = 0,
        remarks =
        CASE
          WHEN jsonb_typeof(remarks)='array'
            THEN remarks || $1::jsonb
          ELSE jsonb_build_array(remarks) || $1::jsonb
        END
      WHERE id = $2
      `;

    const { rows } = await executeInTransaction(client, queryText, [
      JSON.stringify(remark),
      r_id
    ]);

    return {
      data: rows[0],
      message: `Vendor ${vendor.vendor_name} deleted`
    };

  }
  async removeFirmVendor(data: RemoveFirmVendorParams, client: PoolClient) {

    const { r_id, remark, firm_id, company_id } = data;

    const vendor = await getRecord(r_id, "vendors", "company_id", company_id, client);

    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }

    if (!vendor.firms.includes(Number(firm_id))) {
      throw new AppError("Vendor does not belong to this branch", 400);
    }

    const updatedfirms = vendor.firms.filter(
      (id: number) => id !== Number(firm_id)
    );

    const queryText = `
      UPDATE vendors
      SET
        firms = array_remove(firms, $1),

        status = CASE
          WHEN array_length(array_remove(firms, $1), 1) IS NULL
          THEN 0
          ELSE status
        END,

        remarks =
        CASE
          WHEN remarks IS NULL THEN $2::jsonb
          WHEN jsonb_typeof(remarks)='array'
            THEN remarks || $2::jsonb
          ELSE jsonb_build_array(remarks) || $2::jsonb
        END

      WHERE id = $3
      RETURNING *;
    `;

    const { rows } = await executeInTransaction(client, queryText, [
      Number(firm_id),
      JSON.stringify(remark),
      r_id
    ]);

    return {
      data: rows[0],
      message: `Vendor removed from branch successfully`
    };

  }
  async getVendorReportSummary(data: {
    level: "firm" | "branch" | "company";
    firm_id?: number;
    branch_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
  }) {

    const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

    return transaction(async (client) => {

      let firmIds: number[] = [];

      /* ================= GET FIRM IDS ================= */

      if (level === "firm") {
        firmIds = [firm_id!];
      }

      if (level === "branch") {
        const firms = await executeInTransaction(
          client,
          `SELECT id FROM firm WHERE branch_id = $1`,
          [branch_id]
        );
        firmIds = firms.rows.map((f: any) => f.id);
      }

      if (level === "company") {
        const firms = await executeInTransaction(
          client,
          `
  SELECT f.id
  FROM firm f
  JOIN branches b ON b.id = f.branch_id
  WHERE b.company_id = $1
  `,
          [company_id]
        );
        firmIds = firms.rows.map((f: any) => f.id);
      }
      if (!firmIds.length) {
        return {};
      }

      /* ================= MAIN REPORT ================= */

      const report = await this.getVendorReportByFirms(
        client,
        firmIds,
        start_date,
        end_date
      );

      /* ================= COMPANY EXTRA ================= */

      if (level === "company") {

        const branchWise = await executeInTransaction(
          client,
          `
        SELECT 
          b.id AS branch_id,
          b.branch_name,
          SUM(p.final_amount) AS total_purchase
        FROM branches b
        JOIN firm f ON f.branch_id = b.id
        JOIN purchases p ON p.firm_id = f.id
        WHERE b.company_id = $1
        GROUP BY b.id
        `,
          [company_id]
        );

        const firmWise = await executeInTransaction(
          client,
          `
        SELECT 
          f.id AS firm_id,
          f.firm_name,
          SUM(p.final_amount) AS total_purchase
        FROM firm f
        JOIN purchases p ON p.firm_id = f.id
        WHERE f.id= ANY($1)
        GROUP BY f.id
        `,
          [firmIds]
        );

        return {
          overall: report,
          branch_wise: branchWise.rows,
          firm_wise: firmWise.rows
        };
      }

      return report;
    });
  }

  private async getVendorReportByFirms(
    client: any,
    firmIds: number[],
    startDate?: string,
    endDate?: string
  ) {
    const hasDate = Boolean(startDate && endDate);

    const purchaseDate = hasDate
      ? `AND p.bill_date BETWEEN $2 AND $3`
      : "";

    const returnDate = hasDate
      ? `AND pr.return_date BETWEEN $2 AND $3`
      : "";

    const params = hasDate
      ? [firmIds, startDate, endDate]
      : [firmIds];

    /* ================= PURCHASE ================= */

    // 1. Most items bought (count)
    const purchaseMostItems = await executeInTransaction(
      client,
      `
    SELECT 
      v.id AS vendor_id,
      v.vendor_name,
      COUNT(pi.id) AS total_items
    FROM vendors v
    JOIN purchases p 
      ON p.vendor_id = v.id
     AND p.status != 0
     AND p.firm_id = ANY($1)

    JOIN purchase_items pi 
      ON pi.purchase_id = p.id
     AND pi.status != 0
     AND pi.firm_id = ANY($1)

    ${purchaseDate}

    GROUP BY v.id, v.vendor_name
    ORDER BY total_items DESC
    `,
      params
    );

    // 2. Most amount spent
    const purchaseMostAmount = await executeInTransaction(
      client,
      `
    SELECT 
      v.id AS vendor_id,
      v.vendor_name,
      SUM(p.final_amount) AS total_amount
    FROM vendors v
    JOIN purchases p 
      ON p.vendor_id = v.id
     AND p.status = 4
     AND p.firm_id = ANY($1)

    ${purchaseDate}

    GROUP BY v.id, v.vendor_name
    ORDER BY total_amount DESC
    `,
      params
    );

    // 3. Most quantity bought
    const purchaseMostQuantity = await executeInTransaction(
      client,
      `
    SELECT 
      v.id AS vendor_id,
      v.vendor_name,
      SUM(pi.purchased_qty) AS total_quantity
    FROM vendors v
    JOIN purchases p 
      ON p.vendor_id = v.id
     AND p.status != 0
     AND p.firm_id = ANY($1)

    JOIN purchase_items pi 
      ON pi.purchase_id = p.id
     AND pi.status != 0
     AND pi.firm_id = ANY($1)

    ${purchaseDate}

    GROUP BY v.id, v.vendor_name
    ORDER BY total_quantity DESC
    `,
      params
    );

    /* ================= RETURN ================= */

    // 4. Most items returned
    const returnMostItems = await executeInTransaction(
      client,
      `
    SELECT 
      v.id AS vendor_id,
      v.vendor_name,
      COUNT(pri.id) AS total_items
    FROM vendors v
    JOIN purchases p 
      ON p.vendor_id = v.id
     AND p.firm_id = ANY($1)

    JOIN purchase_return pr 
      ON pr.purchase_id = p.id
     AND pr.status != 0
     AND pr.firm_id = ANY($1)

    JOIN purchase_return_items pri 
      ON pri.purchase_return_id = pr.id
     AND pri.status != 0
     AND pri.firm_id = ANY($1)

    ${returnDate}

    GROUP BY v.id, v.vendor_name
    ORDER BY total_items DESC
    `,
      params
    );

    // 5. Most return amount
    const returnMostAmount = await executeInTransaction(
      client,
      `
    SELECT 
      v.id AS vendor_id,
      v.vendor_name,
      SUM(p.final_amount) AS total_amount
    FROM vendors v
    JOIN purchases p 
      ON p.vendor_id = v.id
     AND p.firm_id = ANY($1)

    JOIN purchase_return pr 
      ON pr.purchase_id = p.id
     AND pr.status != 0
     AND pr.firm_id = ANY($1)

    ${returnDate}

    GROUP BY v.id, v.vendor_name
    ORDER BY total_amount DESC
    `,
      params
    );

    // 6. Most return quantity
    const returnMostQuantity = await executeInTransaction(
      client,
      `
    SELECT 
      v.id AS vendor_id,
      v.vendor_name,
      SUM(pri.returned_qty) AS total_quantity
    FROM vendors v
    JOIN purchases p 
      ON p.vendor_id = v.id
     AND p.firm_id = ANY($1)

    JOIN purchase_return pr 
      ON pr.purchase_id = p.id
     AND pr.status != 0
     AND pr.firm_id = ANY($1)

    JOIN purchase_return_items pri 
      ON pri.purchase_return_id = pr.id
     AND pri.status != 0
     AND pri.firm_id = ANY($1)

    ${returnDate}

    GROUP BY v.id, v.vendor_name
    ORDER BY total_quantity DESC
    `,
      params
    );

    return {
      purchase: {
        most_items: purchaseMostItems.rows,
        most_amount: purchaseMostAmount.rows,
        most_quantity: purchaseMostQuantity.rows
      },
      return: {
        most_items: returnMostItems.rows,
        most_amount: returnMostAmount.rows,
        most_quantity: returnMostQuantity.rows
      }
    };
  }
}