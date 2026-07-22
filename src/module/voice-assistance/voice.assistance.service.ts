import { executeInTransaction, transaction } from "../../config/db";
import { VoiceCommandReq } from "./voice.assistance.types";
import axios from "axios";
import { PoolClient } from "pg";
import { AppError } from "../../utils/AppError";
const FULL_DAY_MINUTES = 360;
const HALF_DAY_MINUTES = 210;
const PAID_LEAVE = 2;

type EntityFilterKey = "branch" | "firm" | "company";

const ENTITY_FILTERS: Record<EntityFilterKey, { table: string; nameColumn: string; idColumn: string }> = {
  branch: { table: "branches", nameColumn: "branch_name", idColumn: "branch_id" },
  firm: { table: "firm", nameColumn: "firm_name", idColumn: "firm_id" },
  company: { table: "company", nameColumn: "company_name", idColumn: "company_id" },
};

const STOCK_FILTER_COLUMNS: Record<string, string> = {
  branch_id: "s.branch_id",
  firm_id: "s.firm_id",
  product_id: "s.product_id",
  company_id: "b.company_id",
};

const ALLOWED_MODULES: Record<string, string> = {
  stock: "stock",
};

const ALLOWED_AGGREGATIONS = new Set(["count", "sum", "avg", "min", "max"]);
const ALLOWED_METRICS = new Set(["id", "product_id", "available_quantity", "purchased_qty"]);

export default class VoiceAssistService {
  async voiceCommand(data: VoiceCommandReq) {

    const { message, ...rest } = data
    return transaction(async (client) => {
      try {
        const response = await axios.post(
          "http://192.168.0.101:8000/process",
          {
            "text": message
          },
          // {
          //   headers: {
          //     Authorization: `Bearer YOUR_TOKEN`,
          //     "Content-Type": "application/json",
          //   },
          // }
        );

        const normalizedResponse = await this.normalizeMlResponse(response.data, client);
        const result = await executeInTransaction(client, normalizedResponse.sql, [])
        return result.rows
      } catch (error: any) {

        if (error instanceof AppError) throw error;

        throw new Error("Failed to respond with voice command");
      }

    });
  }
  private async normalizeMlResponse(responseData: any, client: PoolClient) {
    const normalized = {
      ...responseData,
      query: responseData?.query
        ? {
          ...responseData.query,
          filters: { ...(responseData.query.filters ?? {}) },
        }
        : responseData?.query,
    };

    if (!normalized.query?.filters) return normalized;

    const filters = normalized.query.filters;

    for (const key of Object.keys(ENTITY_FILTERS) as EntityFilterKey[]) {
      const filterValue = filters[key] ?? normalized.entities?.[key] ?? this.extractEntityName(normalized, key);
      if (!filterValue || filters[ENTITY_FILTERS[key].idColumn]) continue;

      const id = await this.resolveEntityId(client, key, String(filterValue));
      delete filters[key];
      filters[ENTITY_FILTERS[key].idColumn] = id;
    }

    normalized.sql = this.buildSql(normalized.query, normalized.sql);
    return normalized;
  }

  private extractEntityName(responseData: any, key: EntityFilterKey) {
    const entityWords: Record<EntityFilterKey, string[]> = {
      branch: ["branch", "branches"],
      firm: ["firm", "firms"],
      company: ["company", "companies"],
    };

    const texts = [responseData?.translated, responseData?.normalized]
      .filter(Boolean)
      .map((value: string) => value.toLowerCase());

    for (const text of texts) {
      for (const entityWord of entityWords[key]) {
        const beforeEntity = text.match(
          new RegExp(`\\b(?:in|from|at|for|of|under|inside)\\s+([a-z0-9&.' -]+?)\\s+${entityWord}\\b`, "i")
        );
        if (beforeEntity?.[1]) return beforeEntity[1].trim();

        const afterEntity = text.match(
          new RegExp(`\\b${entityWord}\\s+([a-z0-9&.' -]+?)(?:\\s|$)`, "i")
        );
        if (afterEntity?.[1]) return afterEntity[1].trim();
      }
    }

    const keywords = responseData?.keywords?.items;
    if (Array.isArray(keywords)) {
      const lowerKeywords = keywords.map((item: any) => String(item).toLowerCase());
      const entityIndex = lowerKeywords.findIndex((item: string) => entityWords[key].includes(item));
      if (entityIndex > 0) return String(keywords[entityIndex - 1]).trim();
    }

    return undefined;
  }
  private async resolveEntityId(client: PoolClient, key: EntityFilterKey, name: string) {
    const entity = ENTITY_FILTERS[key];
    const result = await executeInTransaction(
      client,
      `SELECT id FROM ${entity.table} WHERE LOWER(TRIM(${entity.nameColumn})) = LOWER(TRIM($1)) OR REGEXP_REPLACE(LOWER(${entity.nameColumn}), '\\s+', '', 'g') = REGEXP_REPLACE(LOWER($1), '\\s+', '', 'g') LIMIT 1`,
      [name]
    );

    if (!result.rows.length) {
      throw new AppError(`${key} "${name}" not found`, 404);
    }
    return result.rows[0].id;
  }

  private buildSql(query: any, fallbackSql?: string) {
    const table = ALLOWED_MODULES[query?.module];
    if (!table) return fallbackSql;

    const aggregation = String(query?.aggregation ?? "count").toLowerCase();
    const metric = String(query?.metric ?? "id");

    if (!ALLOWED_AGGREGATIONS.has(aggregation) || !ALLOWED_METRICS.has(metric)) {
      return fallbackSql;
    }

    const filters = query?.filters ?? {};
    const needsBranchJoin = Object.prototype.hasOwnProperty.call(filters, "company_id");
    const conditions = Object.entries(filters)
      .filter(([key]) => STOCK_FILTER_COLUMNS[key])
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value))
      .map(([key, value]) => `${STOCK_FILTER_COLUMNS[key]} = ${value}`);

    const fromClause = needsBranchJoin
      ? `${table} s LEFT JOIN branches b ON b.id = s.branch_id`
      : `${table} s`;
    const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    return `SELECT ${aggregation}(s.${metric}) FROM ${fromClause}${whereClause};`;
  }
}





