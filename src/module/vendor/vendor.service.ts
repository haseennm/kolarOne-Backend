import { query, transaction, executeInTransaction } from "../../config/db";
import { getRecord } from "../../utils/extra";
import { AppError } from "../../utils/AppError";
import {
  CountResult,
  CreateVendorParams,
  DeleteVendorParams,
  EditVendorParams,
  FetchDbVendor,
  FetchVendorParams
} from "./vendor.types";

export default class VendorService {

  async createVendor(data: CreateVendorParams) {

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
      remark
    } = data;

    const result = transaction(async (client) => {

      const company = await getRecord(company_id, "company", "id", company_id, client);

      if (!company) {
        throw new AppError("Company not found", 404);
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
        company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
        company_id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return `${rows[0].vendor_name} created`;
    });

    return result;
  }

  async fetchVendor(data: FetchVendorParams) {

    const { filters = {} } = data;

    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    let where: string[] = [];
    let values: any[] = [];

    where.push(`status != $${values.length + 1}`);
    values.push(0);

    if (filters.search) {

      values.push(`%${filters.search}%`);
      const index = values.length;

      where.push(`
      (
        vendor_name ILIKE $${index}
        OR phone_number ILIKE $${index}
        OR email ILIKE $${index}
        OR gstin ILIKE $${index}
        OR pan ILIKE $${index}
      )
      `);
    }

    if (filters.id) {
      values.push(filters.id);
      where.push(`id = $${values.length}`);
    }

    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`company_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const vendorQuery = `
    SELECT * FROM vendors
    ${whereClause}
    ORDER BY vendor_name
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `;

    const countQuery = `
    SELECT COUNT(*) FROM vendors
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

  async updateVendor(data: EditVendorParams) {

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

    const result = transaction(async (client) => {

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

      return rows[0];
    });

    return result;
  }

  async deleteVendor(data: DeleteVendorParams) {

    const { r_id, remark, company_id } = data;

    const result = transaction(async (client) => {

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

      await executeInTransaction(client, queryText, [
        JSON.stringify(remark),
        r_id
      ]);

      return `Vendor ${vendor.vendor_name} deleted`;
    });

    return result;
  }
}