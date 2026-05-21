import { query } from "../../config/db";
import { AppError } from "../../utils/AppError";
import {
    ActivityRow,
  RecentActivityEntityType,
  RecentActivityItem,
  RecentActivityRequest,
} from "./recent-activity.types";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;


function normalizeTimestamp(value: unknown): string {
  if (typeof value === "number") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  return new Date().toISOString();
}

function safeParseRemarks(remarks: unknown): unknown[] {
  if (!remarks) {
    return [];
  }

  if (Array.isArray(remarks)) {
    return remarks;
  }

  if (typeof remarks === "string") {
    try {
      const parsed = JSON.parse(remarks);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  if (typeof remarks === "object") {
    return [remarks];
  }

  return [];
}

function buildActivityMessage(remark: any, row: ActivityRow): string {
  // Derive a clear verb from remark timestamps or action text
  const hasCreated = remark.created_at !== undefined || remark.created_by !== undefined;
  const hasUpdated = remark.updated_at !== undefined || remark.updated_by !== undefined;
  const isDeleted = remark.deleted_by !== undefined || String(remark.action).toLowerCase().includes("deleted");
  const rawAction = String(remark.action ?? remark.status ?? remark.description ?? remark.title ?? "").trim();

  const reference =
    row.reference_number ||
    String(remark.reference ?? remark.invoice_number ?? remark.bill_number ?? remark.return_number ?? "");

  const sourceLabelMap: Record<string, string> = {
    sale: "sale",
    purchase: "purchase",
    sale_return: "sale return",
    purchase_return: "purchase return",
    // party_balance: "party balance",
    ledger_transaction: "ledger transaction",
  };

  const refTypeMap: Record<string, string> = {
    sale: "invoice",
    purchase: "bill",
    sale_return: "return",
    purchase_return: "return",
  };

  const source = (row.source || "").toString();
  const subject = sourceLabelMap[source] ?? (source || "record");
  const refLabel = refTypeMap[source] ?? "ref";

  if (String(rawAction).toLowerCase().startsWith("paid")) {
    // Keep paid message but prefer structured reference and amount
    const amt = row.amount != null ? ` ${row.amount}` : "";
    if (reference) return `Paid${amt} for ${reference}`;
    return `Paid${amt}`;
  }

  if (hasCreated) {
    return reference
      ? `New ${subject} created (${reference})`
      : `New ${subject} created`;
  }

  if (hasUpdated) {
    return reference ? `Updated ${subject} (${reference})` : `Updated ${subject}`;
  }

  if (isDeleted) {
    return reference ? `Deleted ${subject} (${reference})` : `Deleted ${subject}`;
  }

  // Fallback: if remark.action contains useful text, use it with reference
  if (rawAction) {
    return reference ? `${rawAction} (${reference})` : rawAction;
  }

  return `Activity on ${subject}${reference ? ` (${reference})` : ""}`;
}

export function extractActivitiesFromRemarks(
  remarks: unknown,
  row: ActivityRow
): RecentActivityItem[] {
  const rawItems = safeParseRemarks(remarks);

  // Only emit an activity when there is a "Created" remark.
  // Ignore updates/deletes to avoid repeated data.
  const createdRemark = rawItems.find((r): r is Record<string, unknown> => {
    if (typeof r !== "object" || r === null) return false;
    const rr = r as Record<string, unknown>;
    const action = String(rr.action ?? "").trim().toLowerCase();
    return (
      action.startsWith("created") ||
      rr.created_at !== undefined ||
      rr.created_by !== undefined
    );
  });

  if (!createdRemark) return [];

  const datetime = normalizeTimestamp(
    (createdRemark as Record<string, unknown>).created_at ??
      (createdRemark as Record<string, unknown>).updated_at ??
      (createdRemark as Record<string, unknown>).timestamp ??
      (createdRemark as Record<string, unknown>).date
  );

  return [
    {
      message: buildActivityMessage(createdRemark, row),
      datetime,
      company_name: row.company_name,
      branch_name: row.branch_name,
      firm_name: row.firm_name,
      payment_id: row.id,
      amount: row.amount ?? null,
    },
  ];
}

export default class RecentActivityService {
  async fetchRecentActivity(
    request: RecentActivityRequest
  ): Promise<RecentActivityItem[]> {
    const entity_id = Number(request.entity_id);
    const entity_type = request.entity_type?.toUpperCase() as RecentActivityEntityType;
    const limit = Math.min(
      Math.max(request.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    if (!entity_id || Number.isNaN(entity_id)) {
      throw new AppError("Invalid entity_id", 400);
    }

    if (!["C", "B", "F"].includes(entity_type)) {
      throw new AppError("Invalid entity_type. Allowed values: C, B, F", 400);
    }

    const fetchers = [
      this.fetchSaleRows(entity_type, entity_id, limit),
      this.fetchPurchaseRows(entity_type, entity_id, limit),
      this.fetchSaleReturnRows(entity_type, entity_id, limit),
      this.fetchPurchaseReturnRows(entity_type, entity_id, limit),
      // this.fetchPartyBalanceRows(entity_type, entity_id, limit),
      this.fetchLedgerTransactionRows(entity_type, entity_id, limit),
    ];

    const results = await Promise.all(fetchers);
    const activities = results
      .flat()
      .flatMap((row) => extractActivitiesFromRemarks(row.remarks, row));

    return activities
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      )
      .slice(0, limit);
  }

  private getEntityFilter(
    entityType: RecentActivityEntityType,
    alias: string
  ): string {
    switch (entityType) {
      case "F":
        return `${alias}.firm_id = $2`;
      case "B":
        return `f.branch_id = $2`;
      case "C":
        return `c.id = $2`;
      default:
        return "FALSE";
    }
  }

  private async fetchSaleRows(
    entityType: RecentActivityEntityType,
    entityId: number,
    limit: number
  ): Promise<ActivityRow[]> {
    const sql = `
      SELECT
        s.id,
        COALESCE(s.remarks, '[]'::jsonb) AS remarks,
        s.invoice_number AS reference_number,
        s.final_amount AS amount,
        'sale' AS source,
        c.company_name,
        b.branch_name,
        f.firm_name
      FROM sales s
      LEFT JOIN firm f ON f.id = s.firm_id
      LEFT JOIN branches b ON b.id = f.branch_id
      LEFT JOIN company c ON c.id = b.company_id
      WHERE s.status != 0
        AND ${this.getEntityFilter(entityType, "s")}
      ORDER BY s.invoice_date DESC NULLS LAST, s.id DESC
      LIMIT $1
    `;

    return query<ActivityRow>(sql, [limit, entityId]);
  }

  private async fetchPurchaseRows(
    entityType: RecentActivityEntityType,
    entityId: number,
    limit: number
  ): Promise<ActivityRow[]> {
    const sql = `
      SELECT
        p.id,
        COALESCE(p.remarks, '[]'::jsonb) AS remarks,
        p.bill_number AS reference_number,
        p.final_amount AS amount,
        'purchase' AS source,
        c.company_name,
        b.branch_name,
        f.firm_name
      FROM purchases p
      LEFT JOIN firm f ON f.id = p.firm_id
      LEFT JOIN branches b ON b.id = f.branch_id
      LEFT JOIN company c ON c.id = b.company_id
      WHERE p.status != 0
        AND ${this.getEntityFilter(entityType, "p")}
      ORDER BY p.bill_date DESC NULLS LAST, p.id DESC
      LIMIT $1
    `;

    return query<ActivityRow>(sql, [limit, entityId]);
  }

  private async fetchSaleReturnRows(
    entityType: RecentActivityEntityType,
    entityId: number,
    limit: number
  ): Promise<ActivityRow[]> {
    const sql = `
      SELECT
        sr.id,
        COALESCE(sr.remarks, '[]'::jsonb) AS remarks,
        sr.return_number AS reference_number,
        sr.final_amount AS amount,
        'sale_return' AS source,
        c.company_name,
        b.branch_name,
        f.firm_name
      FROM sale_return sr
      LEFT JOIN firm f ON f.id = sr.firm_id
      LEFT JOIN branches b ON b.id = f.branch_id
      LEFT JOIN company c ON c.id = b.company_id
      WHERE sr.status != 0
        AND ${this.getEntityFilter(entityType, "sr")}
      ORDER BY sr.return_date DESC NULLS LAST, sr.id DESC
      LIMIT $1
    `;

    return query<ActivityRow>(sql, [limit, entityId]);
  }

  private async fetchPurchaseReturnRows(
    entityType: RecentActivityEntityType,
    entityId: number,
    limit: number
  ): Promise<ActivityRow[]> {
    const sql = `
      SELECT
        pr.id,
        COALESCE(pr.remarks, '[]'::jsonb) AS remarks,
        pr.return_number AS reference_number,
        pr.final_amount AS amount,
        'purchase_return' AS source,
        c.company_name,
        b.branch_name,
        f.firm_name
      FROM purchase_return pr
      LEFT JOIN firm f ON f.id = pr.firm_id
      LEFT JOIN branches b ON b.id = f.branch_id
      LEFT JOIN company c ON c.id = b.company_id
      WHERE pr.status != 0
        AND ${this.getEntityFilter(entityType, "pr")}
      ORDER BY pr.return_date DESC NULLS LAST, pr.id DESC
      LIMIT $1
    `;

    return query<ActivityRow>(sql, [limit, entityId]);
  }

  // private async fetchPartyBalanceRows(
  //   entityType: RecentActivityEntityType,
  //   entityId: number,
  //   limit: number
  // ): Promise<ActivityRow[]> {
  //   const sql = `
  //     SELECT
  //       pb.id,
  //       COALESCE(pb.remarks, '[]'::jsonb) AS remarks,
  //       NULL::text AS reference_number,
  //       pb.balance AS amount,
  //       'party_balance' AS source,
  //       c.company_name,
  //       b.branch_name,
  //       f.firm_name
  //     FROM party_balance pb
  //     LEFT JOIN firm f ON f.id = pb.firm_id
  //     LEFT JOIN branches b ON b.id = f.branch_id
  //     LEFT JOIN company c ON c.id = b.company_id
  //     WHERE pb.status != 0
  //       AND ${this.getEntityFilter(entityType, "pb")}
  //     ORDER BY pb.id DESC
  //     LIMIT $1
  //   `;

  //   return query<ActivityRow>(sql, [limit, entityId]);
  // }

  private async fetchLedgerTransactionRows(
    entityType: RecentActivityEntityType,
    entityId: number,
    limit: number
  ): Promise<ActivityRow[]> {
    const filter = this.getLedgerFilter(entityType);
    const sql = `
      SELECT
        lt.id,
        COALESCE(lt.remarks, '[]'::jsonb) AS remarks,
        lt.reference_id::text AS reference_number,
        lt.amount AS amount,
        'ledger_transaction' AS source,
        COALESCE(c.company_name, b.branch_name, f.firm_name) AS company_name,
        b.branch_name,
        f.firm_name
      FROM ledger_transactions lt
      LEFT JOIN company c ON lt.entity_type = 'C' AND lt.entity_id = c.id
      LEFT JOIN branches b ON lt.entity_type = 'B' AND lt.entity_id = b.id
      LEFT JOIN firm f ON lt.entity_type = 'F' AND lt.entity_id = f.id
      WHERE lt.status != 0
        AND (${filter})
      ORDER BY lt.transaction_date DESC NULLS LAST, lt.id DESC
      LIMIT $1
    `;

    return query<ActivityRow>(sql, [limit, entityId]);
  }

  private getLedgerFilter(entityType: RecentActivityEntityType): string {
    switch (entityType) {
      case "F":
        return "lt.entity_type = 'F' AND lt.entity_id = $2";
      case "B":
        return `(
          (lt.entity_type = 'B' AND lt.entity_id = $2)
          OR (lt.entity_type = 'F' AND f.branch_id = $2)
        )`;
      case "C":
        return `(
          (lt.entity_type = 'C' AND lt.entity_id = $2)
          OR (lt.entity_type = 'B' AND b.company_id = $2)
          OR (lt.entity_type = 'F' AND f.branch_id IN (SELECT id FROM branches WHERE company_id = $2))
        )`;
      default:
        return "FALSE";
    }
  }
}
