import { executeInTransaction, query, transaction } from "../../config/db";
import { getRecord } from "../../utils/extra";
import {
  CountResult,
  CreateStockRentParams,
  DeleteStockRentParams,
  EditStockRentBody,
  EditStockRentParams,
  FetchDbStockRent,
  FetchStockRentParams,
} from "./stockRent.types";
import { AppError } from "../../utils/AppError";

export default class StockRentalService {

  async createStockRental(data: CreateStockRentParams) {
    const {
      company_id,
      branch_id,
      default_return_date,
      stock_type,
      price_day,
      price_hour,
      price_month,
      price_week,
      product_id,
      total_units,
      unique_name,
      statusCode,
      remark,
    } = data;

    return transaction(async (client) => {

      const isCompanyExist = await getRecord(company_id,
        "company",
        "id",
        company_id,
        client);
      if (!isCompanyExist) { throw new AppError("Company not found", 404); }

      const isbranchExist = await getRecord(branch_id,
        "branches",
        "company_id",
        company_id,
        client);
      if (!isbranchExist) { throw new AppError("Branch not found", 404); }

      const isproductExist = await getRecord(product_id,
        "products",
        "company_id",
        company_id,
        client);
      if (!isproductExist) { throw new AppError("Product not found", 404); }

      /**
       * INDIVIDUAL STOCK
       */
      if (stock_type === "I") {
        const insertedRows = [];

        for (const name of unique_name) {
          const { rows } = await executeInTransaction(
            client,
            `
          INSERT INTO rental_stocks (
            company_id,
            branch_id,
            product_id,
            stock_type,
            total_units,
            available_units,
            unique_name,
            hourly_rate,
            daily_rate,
            weekly_rate,
            monthly_rate,
            default_return_days,
            status,
            remarks
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,$14
          )
          RETURNING *;
          `,
            [
              company_id,
              branch_id,
              product_id,
              "I",
              1,
              1,
              name,
              price_hour,
              price_day,
              price_week,
              price_month,
              default_return_date,
              statusCode,
              JSON.stringify(remark ?? {}),
            ]
          );

          insertedRows.push(rows[0]);
        }

        return {
          message: `${insertedRows.length} individual stocks created`,
          count: insertedRows.length,
          data: insertedRows,
        };
      }

      /**
       * GROUP STOCK
       */
      const { rows } = await executeInTransaction(
        client,
        `
      INSERT INTO rental_stocks (
        company_id,
        branch_id,
        product_id,
        stock_type,
        total_units,
        available_units,
        hourly_rate,
        daily_rate,
        weekly_rate,
        monthly_rate,
        default_return_days,
        status,
        remarks
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,$13
      )
      RETURNING *;
      `,
        [
          company_id,
          branch_id,
          product_id,
          "G",
          total_units,
          total_units,
          price_hour,
          price_day,
          price_week,
          price_month,
          default_return_date,
          statusCode,
          JSON.stringify(remark ?? {}),
        ]
      );

      return {
        message: "Group stock created",
        data: rows[0],
      };
    });
  }

  async fetchStockRental(data: FetchStockRentParams) {
    const { filters = {} } = data;

    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const values: any[] = [];

    // status filter
    if (filters.status !== undefined) {
      values.push(filters.status);
      where.push(`rs.status = $${values.length}`);
    } else {
      values.push(0);
      where.push(`rs.status != $${values.length}`);
    }

    // stock id
    if (filters.id) {
      values.push(filters.id);
      where.push(`rs.id = $${values.length}`);
    }

    // company filter
    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`rs.company_id = $${values.length}`);
    }

    // branch filter
    if (filters.branch_id) {
      values.push(filters.branch_id);
      where.push(`rs.branch_id = $${values.length}`);
    }

    // search by product name or unique name
    if (filters.search) {
      values.push(`%${filters.search}%`);
      const idx = values.length;

      where.push(`
      (
        p.name ILIKE $${idx}
        OR rs.unique_name ILIKE $${idx}
      )
    `);
    }

    const whereClause =
      where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const stockQuery = `
   SELECT
  rs.*,
  p.name AS product_name,
  b.branch_name,

  CASE
    WHEN rs.stock_type = 'I' THEN 'Individual'
    WHEN rs.stock_type = 'G' THEN 'Group'
    ELSE rs.stock_type
  END AS stock_type_name

FROM rental_stocks rs
LEFT JOIN products p
  ON p.id = rs.product_id
LEFT JOIN branches b
  ON b.id = rs.branch_id
  AND b.company_id = rs.company_id

${whereClause}

ORDER BY rs.id DESC
LIMIT $${values.length + 1}
OFFSET $${values.length + 2}
  `;

    const countQuery = `
    SELECT COUNT(*) AS count
    FROM rental_stocks rs
    LEFT JOIN products p
      ON p.id = rs.product_id
    LEFT JOIN branches b
      ON b.id = rs.branch_id
      AND b.company_id = rs.company_id

    ${whereClause}
  `;

    const rent_stock = await query<FetchDbStockRent>(
      stockQuery,
      [...values, limit, offset]
    );

    const total = await query<CountResult>(countQuery, values);

    const mappedRentStock = rent_stock.map((row: any) => ({
      ...row,
      available_rate_types: [
        ...(Number(row.hourly_rate ?? 0) > 0 ? ["hour"] : []),
        ...(Number(row.daily_rate ?? 0) > 0 ? ["day"] : []),
        ...(Number(row.weekly_rate ?? 0) > 0 ? ["week"] : []),
        ...(Number(row.monthly_rate ?? 0) > 0 ? ["month"] : []),
      ],
    }));

    return {
      rent_stock: mappedRentStock,
      page,
      limit,
      total: Number(total[0].count),
    };
  }

  async updateStockRental(data: EditStockRentParams) {

    const {
      id,
       company_id,
          branch_id,
          default_return_date,
          price_day,
          price_hour,
          price_month,
          price_week,
          product_id,
          statusCode,
          total_units,
          unique_name,
          remark
    } = data;

    const result = transaction(async (client) => {

      const isRentStockExist = await getRecord(
        id,
        "customers",
        "company_id",
        company_id,
        client
      );

      if (!isRentStockExist) {
        throw new AppError("Stock not found For rent", 404);
      }
      if(product_id){

        const isProductExist = await getRecord(
          product_id,
          "products",
          "company_id",
          company_id,
          client
        );
  
        if (!isProductExist) {
          throw new AppError("Product not found", 404);
        }
      }

      const queryText = `
      UPDATE rental_stocks
      SET
          default_return_date = $2,
          price_day = $3,
          price_hour = $4,
          price_month = $5,
          price_week = $6,
          product_id = $7,
          status = $8,
          total_units = $9,
          unique_name = $10
        remarks =
          CASE
            WHEN remarks IS NULL THEN $11::jsonb
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $11::jsonb
            ELSE jsonb_build_array(remarks) || $11::jsonb
          END,
      WHERE id = $12 AND branch_id = $13
      RETURNING *;
      `;

      const values = [
        default_return_date ?? isRentStockExist.default_return_date,
        price_day ?? isRentStockExist.price_day,
        price_hour ?? isRentStockExist.price_hour,
        price_month ?? isRentStockExist.price_month,
        price_week ?? isRentStockExist.price_week,
        product_id ?? isRentStockExist.product_id,
        statusCode ?? isRentStockExist.status,
        total_units ?? isRentStockExist.total_units,
        unique_name ?? isRentStockExist.unique_name,
        JSON.stringify(remark),
        id,
        branch_id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);

      return rows[0];
    });

    return result;
  }

  async deleteStockRental(data: DeleteStockRentParams) {

    const { r_id, remark, branch_id } = data;

    const result = transaction(async (client) => {

      const isStockRentExist = await getRecord(
        r_id,
        "rental_stocks",
        "branch_id",
        branch_id,
        client
      );

      if (!isStockRentExist) {
        throw new AppError("stock for rental not found or already deleted", 404);
      }

      const queryText = `
      UPDATE rental_stocks
      SET
        status = $1,
        remarks =
          CASE
            WHEN jsonb_typeof(remarks) = 'array'
              THEN remarks || $2::jsonb
            ELSE jsonb_build_array(remarks) || $2::jsonb
          END
      WHERE id = $3
      RETURNING *;
      `;

      const values = [
        0,
        JSON.stringify(remark),
        r_id
      ];

      await executeInTransaction(client, queryText, values);

      return `Rental ${isStockRentExist.unique_name} deleted successfully`;
    });

    return result;
  }
  // async getStockRentalReportSummary(data: GetCustomerReport) {

  //   const { level, firm_id, branch_id, company_id, start_date, end_date } = data;

  //   return transaction(async (client) => {

  //     let firmIds: number[] = [];

  //     /* ================= GET FIRM IDS ================= */

  //     if (level === "firm") {
  //       firmIds = [firm_id!];
  //     }

  //     if (level === "branch") {
  //       const firms = await executeInTransaction(
  //         client,
  //         `SELECT id FROM firm WHERE branch_id = $1`,
  //         [branch_id]
  //       );
  //       firmIds = firms.rows.map((f: any) => f.id);
  //     }

  //     if (level === "company") {
  //       const firms = await executeInTransaction(
  //         client,
  //         `
  //         SELECT f.id
  //         FROM firm f
  //         JOIN branches b ON b.id = f.branch_id
  //         WHERE b.company_id = $1
  //         `,
  //         [company_id]
  //       );
  //       firmIds = firms.rows.map((f: any) => f.id);
  //     }

  //     if (!firmIds.length) return {};

  //     /* ================= MAIN REPORT ================= */

  //     const report = await this.getCustomerReportByFirms(
  //       client,
  //       firmIds,
  //       start_date,
  //       end_date
  //     );

  //     /* ================= COMPANY EXTRA ================= */

  //     if (level === "company") {

  //       const branchWise = await executeInTransaction(
  //         client,
  //         `
  //         SELECT 
  //           b.id AS branch_id,
  //           b.branch_name,
  //           SUM(s.final_amount) AS total_sales
  //         FROM branches b
  //         JOIN firm f ON f.branch_id = b.id
  //         JOIN sales s ON s.firm_id = f.id
  //         WHERE b.company_id = $1
  //         GROUP BY b.id
  //         `,
  //         [company_id]
  //       );

  //       const firmWise = await executeInTransaction(
  //         client,
  //         `
  //         SELECT 
  //           f.id AS firm_id,
  //           f.firm_name,
  //           SUM(s.final_amount) AS total_sales
  //         FROM firm f
  //         JOIN sales s ON s.firm_id = f.id
  //         WHERE f.id = ANY($1)
  //         GROUP BY f.id
  //         `,
  //         [firmIds]
  //       );

  //       return {
  //         overall: report,
  //         branch_wise: branchWise.rows,
  //         firm_wise: firmWise.rows
  //       };
  //     }

  //     return report;
  //   });
  // }

  // /* ============================================================ */

  // private async getCustomerReportByFirms(
  //   client: any,
  //   firmIds: number[],
  //   startDate?: string,
  //   endDate?: string
  // ) {
  //   const hasDate = Boolean(startDate && endDate);

  //   const salesDate = hasDate
  //     ? `AND s.invoice_date BETWEEN $2 AND $3`
  //     : "";

  //   const returnDate = hasDate
  //     ? `AND sr.return_date BETWEEN $2 AND $3`
  //     : "";

  //   const params = hasDate
  //     ? [firmIds, startDate, endDate]
  //     : [firmIds];

  //   /* ================= SALES ================= */

  //   // 1. Most items sold (count)
  //   const mostItemsSold = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     c.id AS customer_id,
  //     c.customer_name,
  //     COUNT(si.id) AS total_items
  //   FROM customers c
  //   JOIN sales s 
  //     ON s.customer_id = c.id
  //    AND s.status != 0
  //    AND s.firm_id = ANY($1)

  //   JOIN sales_items si 
  //     ON si.sale_id = s.id
  //    AND si.status != 0
  //    AND si.firm_id = ANY($1)

  //   ${salesDate}

  //   GROUP BY c.id, c.customer_name
  //   ORDER BY total_items DESC
  //   `,
  //     params
  //   );

  //   // 2. Most amount spent
  //   const mostAmount = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     c.id AS customer_id,
  //     c.customer_name,
  //     SUM(s.final_amount) AS total_amount
  //   FROM customers c
  //   JOIN sales s 
  //     ON s.customer_id = c.id
  //    AND s.status = 4
  //    AND s.firm_id = ANY($1)

  //   ${salesDate}

  //   GROUP BY c.id, c.customer_name
  //   ORDER BY total_amount DESC
  //   `,
  //     params
  //   );

  //   // 3. Most quantity sold
  //   const mostQuantity = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     c.id AS customer_id,
  //     c.customer_name,
  //     SUM(si.saled_qty) AS total_quantity
  //   FROM customers c
  //   JOIN sales s 
  //     ON s.customer_id = c.id
  //    AND s.status != 0
  //    AND s.firm_id = ANY($1)

  //   JOIN sales_items si 
  //     ON si.sale_id = s.id
  //    AND si.status != 0
  //    AND si.firm_id = ANY($1)

  //   ${salesDate}

  //   GROUP BY c.id, c.customer_name
  //   ORDER BY total_quantity DESC
  //   `,
  //     params
  //   );

  //   // 4. Customers with pending balance
  //   const customersWithBalance = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     COUNT(DISTINCT c.id) AS total_customers_with_balance
  //   FROM customers c
  //   JOIN sales s 
  //     ON s.customer_id = c.id
  //    AND s.status = 4
  //    AND s.firm_id = ANY($1)
  //    AND s.final_amount > s.paid

  //   ${salesDate}
  //   `,
  //     params
  //   );

  //   /* ================= RETURN ================= */

  //   // 5. Most items returned
  //   const mostReturnItems = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     c.id AS customer_id,
  //     c.customer_name,
  //     COUNT(sri.id) AS total_items
  //   FROM customers c
  //   JOIN sales s 
  //     ON s.customer_id = c.id
  //    AND s.firm_id = ANY($1)

  //   JOIN sale_return sr 
  //     ON sr.sale_id = s.id
  //    AND sr.status != 0
  //    AND sr.firm_id = ANY($1)

  //   JOIN sale_return_items sri 
  //     ON sri.sale_return_id = sr.id
  //    AND sri.status != 0
  //    AND sri.firm_id = ANY($1)

  //   ${returnDate}

  //   GROUP BY c.id, c.customer_name
  //   ORDER BY total_items DESC
  //   `,
  //     params
  //   );

  //   // 6. Most return amount
  //   const mostReturnAmount = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     c.id AS customer_id,
  //     c.customer_name,
  //     SUM(sr.final_amount) AS total_amount
  //   FROM customers c
  //   JOIN sales s 
  //     ON s.customer_id = c.id
  //    AND s.firm_id = ANY($1)

  //   JOIN sale_return sr 
  //     ON sr.sale_id = s.id
  //    AND sr.status != 0
  //    AND sr.firm_id = ANY($1)

  //   ${returnDate}

  //   GROUP BY c.id, c.customer_name
  //   ORDER BY total_amount DESC
  //   `,
  //     params
  //   );

  //   // 7. Most return quantity
  //   const mostReturnQuantity = await executeInTransaction(
  //     client,
  //     `
  //   SELECT 
  //     c.id AS customer_id,
  //     c.customer_name,
  //     SUM(sri.returned_qty) AS total_quantity
  //   FROM customers c
  //   JOIN sales s 
  //     ON s.customer_id = c.id
  //    AND s.firm_id = ANY($1)

  //   JOIN sale_return sr 
  //     ON sr.sale_id = s.id
  //    AND sr.status != 0
  //    AND sr.firm_id = ANY($1)

  //   JOIN sale_return_items sri 
  //     ON sri.sale_return_id = sr.id
  //    AND sri.status != 0
  //    AND sri.firm_id = ANY($1)

  //   ${returnDate}

  //   GROUP BY c.id, c.customer_name
  //   ORDER BY total_quantity DESC
  //   `,
  //     params
  //   );

  //   return {
  //     sales: {
  //       most_items: mostItemsSold.rows,
  //       most_amount: mostAmount.rows,
  //       most_quantity: mostQuantity.rows,
  //       customers_with_balance:
  //         customersWithBalance.rows[0]?.total_customers_with_balance || 0
  //     },
  //     return: {
  //       most_items: mostReturnItems.rows,
  //       most_amount: mostReturnAmount.rows,
  //       most_quantity: mostReturnQuantity.rows
  //     }
  //   };
  // }
}