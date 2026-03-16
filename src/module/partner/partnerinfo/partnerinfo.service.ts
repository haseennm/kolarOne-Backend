import { query, transaction, executeInTransaction } from "../../../config/db";
import { isExist } from "../../../utils/extra";
import { AppError } from "../../../utils/AppError";
import { 
  CreatePartnerParams, 
  FetchPartnerParams, 
  EditPartnerParams, 
  DeletePartnerParams 
} from "./partnerinfo.types";

export default class PartnerService {
  async createPartner(data: CreatePartnerParams) {
    return transaction(async (client) => {
      const company = await isExist(data.company_id, "company", "id", data.company_id, client);
      if (!company) throw new AppError("Company not found", 404);

      const queryText = `
        INSERT INTO partners_info (name, address, phone_number, city, district, state, pincode, status, remarks, company_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
      const values = [
        data.name, data.address, data.phone_number, data.city, data.district, 
        data.state, data.pincode, data.statusCode, JSON.stringify([data.remark]), data.company_id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);
      return `${rows[0].name} created successfully`;
    });
  }

  async fetchPartners(data: FetchPartnerParams) {
    const { filters = {} } = data;
    const limit = filters.limit ?? 10;
    const offset = data.offset ?? 0;

    let where = ["status != 0"];
    let values: any[] = [];

    if (filters.search) {
      values.push(`%${filters.search}%`);
      where.push(`(name ILIKE $${values.length} OR phone_number ILIKE $${values.length} OR city ILIKE $${values.length})`);
    }

    if (filters.company_id) {
      values.push(filters.company_id);
      where.push(`company_id = $${values.length}`);
    }

    const whereClause = `WHERE ${where.join(" AND ")}`;
    const partners = await query(`SELECT * FROM partners_info ${whereClause} ORDER BY name LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]);
    const total = await query(`SELECT COUNT(*) FROM partners_info ${whereClause}`, values);

    return { partners, page: filters.page, limit, total: Number(total[0].count) };
  }

  async updatePartner(data: EditPartnerParams) {
    return transaction(async (client) => {
      const partner = await isExist(data.id, "partners_info", "company_id", data.company_id, client);
      if (!partner) throw new AppError("Partner not found", 404);

      const queryText = `
        UPDATE partners_info SET
          name = $1, address = $2, phone_number = $3, city = $4, district = $5, state = $6, pincode = $7, status = $8,
          remarks = CASE 
            WHEN jsonb_typeof(remarks)='array' THEN remarks || $9::jsonb 
            ELSE jsonb_build_array(remarks) || $9::jsonb 
          END
        WHERE id = $10 RETURNING *;
      `;
      const values = [
        data.name ?? partner.name, data.address ?? partner.address, data.phone_number ?? partner.phone_number,
        data.city ?? partner.city, data.district ?? partner.district, data.state ?? partner.state,
        data.pincode ?? partner.pincode, data.statusCode ?? partner.status, JSON.stringify(data.remark), data.id
      ];

      const { rows } = await executeInTransaction(client, queryText, values);
      return rows[0];
    });
  }

  async deletePartner(data: DeletePartnerParams) {
    return transaction(async (client) => {
      const partner = await isExist(data.id, "partners_info", "company_id", data.company_id, client);
      if (!partner) throw new AppError("Partner not found", 404);

      const queryText = `UPDATE partners_info SET status = 0, remarks = remarks || $1::jsonb WHERE id = $2`;
      await executeInTransaction(client, queryText, [JSON.stringify(data.remark), data.id]);
      return `Partner ${partner.name} deleted`;
    });
  }
}