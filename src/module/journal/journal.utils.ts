import { PoolClient } from "pg";
import { toShortTableName } from "../../utils/extra";
import { JournalController } from "./journal.controller";
import { ParentConfig } from "./journal.types";

const IGNORED_CHANGE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "deleted_by",
  "password",
  "last_login",
  "remarks",
  "remark",
]);

function normalizeValue(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim();
  return value;
}

export function buildAuditChanges(oldRecord: Record<string, any>, newRecord: Record<string, any>) {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const [key, newValue] of Object.entries(newRecord)) {
    if (IGNORED_CHANGE_FIELDS.has(key)) continue;

    const oldValue = oldRecord?.[key];
    const normalizedOld = normalizeValue(oldValue);
    const normalizedNew = normalizeValue(newValue);

    if (normalizedOld !== normalizedNew) {
      changes[key] = {
        old: normalizedOld,
        new: normalizedNew,
      };
    }
  }

  return changes;
}

function getRecordValue(record: Record<string, any> | undefined, keys: string[]) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== "") {
      return record[key];
    }
  }

  return undefined;
}

function getTableLabel(tableName: string) {
  const normalized = tableName.toLowerCase();
  if (normalized === "branches") return "Branch";
  if (normalized === "brand") return "Brand";
  if (normalized === "company") return "Company";
  if (normalized === "company_branding") return "Company branding";
  if (normalized === "customers") return "Customer";
  if (normalized === "financial_year") return "Financial year";
  if (normalized === "firm") return "Firm";
  if (normalized === "hiring_staff") return "Hiring record";
  if (normalized === "ledger_categories") return "Ledger category";
  if (normalized === "ledger_transactions") return "Ledger transaction";
  if (normalized === "loss_stocks") return "Loss stock";
  if (normalized === "partner_capital_ledger") return "Capital entry";
  if (normalized === "partner_profit_shares") return "Profit share";
  if (normalized === "partners_info") return "Partner";
  if (normalized === "payment_methods") return "Payment method";
  if (normalized === "product_categories") return "Product category";
  if (normalized === "products") return "Product";
  if (normalized === "purchases") return "Purchase invoice";
  if (normalized === "purchase_return") return "Purchase return invoice";
  if (normalized === "quotations") return "Quotation";
  if (normalized === "rent_bills") return "Rent bill";
  if (normalized === "rent_customer_ledger") return "Customer rent ledger";
  if (normalized === "rental_stocks") return "Rental stock";
  if (normalized === "role") return "Role";
  if (normalized === "salary_generations") return "Salary";
  if (normalized === "sales") return "Sale invoice";
  if (normalized === "sale_return") return "Sale return invoice";
  if (normalized === "sale_returns") return "Sale return invoice";
  if (normalized === "staff") return "Staff";
  if (normalized === "staff_loans") return "Loan";
  if (normalized === "stock_adjustments") return "Stock adjustment";
  if (normalized === "vendors") return "Vendor";
  return tableName;
}

export function buildJournalMessage(tableName: string, action: "create" | "update" | "delete" | "confirm" | "repay", record: Record<string, any> = {}) {
  const normalized = tableName.toLowerCase();
  const label = getTableLabel(tableName);
  const productName = getRecordValue(record, ["product_name", "name", "product"]);
  const categoryName = getRecordValue(record, ["category_name", "name"]);
  const invoiceNo = getRecordValue(record, ["invoice_no", "invoice_number", "invoice", "bill_number", "return_number"]);
  const amount = getRecordValue(record, ["totalPayAmount", "amount", "loan_amount", "salary_amount", "pay_amount", "final_amount"]);
  const vendorName = getRecordValue(record, ["vendor_name"]);
  const customerName = getRecordValue(record, ["customer_name", "full_name"]);
  const staffName = getRecordValue(record, ["staff_name", "full_name", "name"]);
  const roleName = getRecordValue(record, ["role_name", "role"]);
  const quantity = getRecordValue(record, ["quantity", "qty"]);
  const loanAmount = getRecordValue(record, ["loan_amount"]);
  const salaryAmount = getRecordValue(record, ["salary_amount", "final_salary"]);
  const partnerName = getRecordValue(record, ["partner_name"]);
  const methodName = getRecordValue(record, ["method_name", "name"]);
  const quotationNo = getRecordValue(record, ["quotation_no"]);
  const billNo = getRecordValue(record, ["bill_no"]);
  const financialYear = getRecordValue(record, ["financial_year"]);

  switch (normalized) {
    case "branches":
      return action === "create"
        ? `Branch "${getRecordValue(record, ["branch_name"]) ?? ""}" created.`
        : action === "update"
          ? `Branch "${getRecordValue(record, ["branch_name"]) ?? ""}" updated.`
          : `Branch "${getRecordValue(record, ["branch_name"]) ?? ""}" deleted.`;
    case "brand":
      return action === "create"
        ? `Brand "${getRecordValue(record, ["name"]) ?? ""}" created.`
        : action === "update"
          ? `Brand "${getRecordValue(record, ["name"]) ?? ""}" updated.`
          : `Brand "${getRecordValue(record, ["name"]) ?? ""}" deleted.`;
    case "company":
      return action === "create"
        ? `Company "${getRecordValue(record, ["company_name"]) ?? ""}" created.`
        : action === "update"
          ? `Company "${getRecordValue(record, ["company_name"]) ?? ""}" updated.`
          : `Company "${getRecordValue(record, ["company_name"]) ?? ""}" deleted.`;
    case "company_branding":
      return action === "create"
        ? "Company branding updated."
        : action === "update"
          ? "Company branding modified."
          : "Company branding removed.";
    case "customers":
      return action === "create"
        ? `Customer "${getRecordValue(record, ["customer_name"]) ?? ""}" created.`
        : action === "update"
          ? `Customer "${getRecordValue(record, ["customer_name"]) ?? ""}" updated.`
          : `Customer "${getRecordValue(record, ["customer_name"]) ?? ""}" deleted.`;
    case "financial_year":
      return action === "create"
        ? `Financial year "${financialYear ?? ""}" created.`
        : action === "update"
          ? `Financial year "${financialYear ?? ""}" updated.`
          : `Financial year "${financialYear ?? ""}" deleted.`;
    case "firm":
      return action === "create"
        ? `Firm "${getRecordValue(record, ["firm_name"]) ?? ""}" created.`
        : action === "update"
          ? `Firm "${getRecordValue(record, ["firm_name"]) ?? ""}" updated.`
          : `Firm "${getRecordValue(record, ["firm_name"]) ?? ""}" deleted.`;
    case "hiring_staff":
      return action === "create"
        ? `Hiring record created for "${staffName ?? ""}".`
        : action === "update"
          ? `Hiring record updated for "${staffName ?? ""}".`
          : `Hiring record deleted for "${staffName ?? ""}".`;
    case "ledger_categories":
      return action === "create"
        ? `Ledger category "${categoryName ?? ""}" created.`
        : action === "update"
          ? `Ledger category "${categoryName ?? ""}" updated.`
          : `Ledger category "${categoryName ?? ""}" deleted.`;
    case "ledger_transactions":
      return action === "create"
        ? `Ledger transaction created. Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Ledger transaction updated. Amount: ${amount ?? 0}.`
          : `Ledger transaction deleted. Amount: ${amount ?? 0}.`;
    case "loss_stocks":
      return action === "create"
        ? `Loss stock recorded for "${productName ?? ""}". Quantity: ${quantity ?? 0}.`
        : action === "update"
          ? `Loss stock updated for "${productName ?? ""}".`
          : `Loss stock deleted for "${productName ?? ""}".`;
    case "partner_capital_ledger":
      return action === "create"
        ? `Capital entry created for "${partnerName ?? ""}". Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Capital entry updated for "${partnerName ?? ""}". Amount: ${amount ?? 0}.`
          : `Capital entry deleted for "${partnerName ?? ""}". Amount: ${amount ?? 0}.`;
    case "partner_profit_shares":
      return action === "create"
        ? `Profit share created for "${partnerName ?? ""}". Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Profit share updated for "${partnerName ?? ""}". Amount: ${amount ?? 0}.`
          : `Profit share deleted for "${partnerName ?? ""}". Amount: ${amount ?? 0}.`;
    case "partners_info":
      return action === "create"
        ? `Partner "${partnerName ?? ""}" created.`
        : action === "update"
          ? `Partner "${partnerName ?? ""}" updated.`
          : `Partner "${partnerName ?? ""}" deleted.`;
    case "payment_methods":
      return action === "create"
        ? `Payment method "${methodName ?? ""}" created.`
        : action === "update"
          ? `Payment method "${methodName ?? ""}" updated.`
          : `Payment method "${methodName ?? ""}" deleted.`;
    case "product_categories":
      return action === "create"
        ? `Product category "${categoryName ?? ""}" created.`
        : action === "update"
          ? `Product category "${categoryName ?? ""}" updated.`
          : `Product category "${categoryName ?? ""}" deleted.`;
    case "products":
      return action === "create"
        ? `Product "${productName ?? ""}" created.`
        : action === "update"
          ? `Product "${productName ?? ""}" updated.`
          : `Product "${productName ?? ""}" deleted.`;
    case "purchases":
      if (action === "repay") {
        return `Repayment of ${amount ?? 0} recorded for Purchase invoice "${invoiceNo ?? ""}".`;
      }
      return action === "create"
        ? `Purchase invoice "${invoiceNo ?? ""}" created. Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Purchase invoice "${invoiceNo ?? ""}" updated. Amount: ${amount ?? 0}.`
          : `Purchase invoice "${invoiceNo ?? ""}" deleted. Amount: ${amount ?? 0}.`;
    case "purchase_return":
      if (action === "repay") {
        return `Repayment of ${amount ?? 0} recorded for Purchase return invoice "${invoiceNo ?? ""}".`;
      }
      return action === "create"
        ? `Purchase return invoice "${invoiceNo ?? ""}" created. Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Purchase return invoice "${invoiceNo ?? ""}" updated. Amount: ${amount ?? 0}.`
          : `Purchase return invoice "${invoiceNo ?? ""}" deleted. Amount: ${amount ?? 0}.`;
    case "quotations":
      return action === "create"
        ? `Quotation "${quotationNo ?? ""}" created.`
        : action === "update"
          ? `Quotation "${quotationNo ?? ""}" updated.`
          : `Quotation "${quotationNo ?? ""}" deleted.`;
    case "rent_bills":
      if (action === "repay") {
        return `Repayment of ${amount ?? 0} recorded for rent invoice "${invoiceNo ?? ""}".`;
      }
      return action === "create"
        ? `Rent bill "${billNo ?? ""}" created. Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Rent bill "${billNo ?? ""}" updated. Amount: ${amount ?? 0}.`
          : `Rent bill "${billNo ?? ""}" deleted. Amount: ${amount ?? 0}.`;
    case "rent_customer_ledger":
      return action === "create"
        ? `Customer rent ledger entry created for "${customerName ?? ""}". Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Customer rent ledger updated for "${customerName ?? ""}". Amount: ${amount ?? 0}.`
          : `Customer rent ledger deleted for "${customerName ?? ""}". Amount: ${amount ?? 0}.`;
    case "rental_stocks":
      return action === "create"
        ? `Rental stock added for "${productName ?? ""}".`
        : action === "update"
          ? `Rental stock updated for "${productName ?? ""}".`
          : `Rental stock deleted for "${productName ?? ""}".`;
    case "role":
      return action === "create"
        ? `Role "${roleName ?? ""}" created.`
        : action === "update"
          ? `Role "${roleName ?? ""}" updated.`
          : `Role "${roleName ?? ""}" deleted.`;
    case "salary_generations":
      return action === "confirm"
        ? `Salary confirmed for "${staffName ?? ""}". Amount: ${salaryAmount ?? 0}.`
        : `Salary confirmed for "${staffName ?? ""}". Amount: ${salaryAmount ?? 0}.`;
    case "sales":
      if (action === "repay") {
        return `Repayment of ${amount ?? 0} recorded for sale invoice "${invoiceNo ?? ""}".`;
      }
      return action === "create"
        ? `Sale invoice "${invoiceNo ?? ""}" created. Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Sale invoice "${invoiceNo ?? ""}" updated. Amount: ${amount ?? 0}.`
          : `Sale invoice "${invoiceNo ?? ""}" deleted. Amount: ${amount ?? 0}.`;
    case "sale_returns":
      if (action === "repay") {
        return `Repayment of ${amount ?? 0} recorded for sale return invoice "${invoiceNo ?? ""}".`;
      }
      return action === "create"
        ? `Sale return invoice "${invoiceNo ?? ""}" created. Amount: ${amount ?? 0}.`
        : action === "update"
          ? `Sale return invoice "${invoiceNo ?? ""}" updated. Amount: ${amount ?? 0}.`
          : `Sale return invoice "${invoiceNo ?? ""}" deleted. Amount: ${amount ?? 0}.`;
    case "staff":
      return action === "create"
        ? `Staff "${staffName ?? ""}" created.`
        : action === "update"
          ? `Staff "${staffName ?? ""}" updated.`
          : `Staff "${staffName ?? ""}" deleted.`;
    case "staff_loans":
      if (action === "confirm" || action === "repay") return `Loan repayment of ${amount ?? loanAmount ?? 0} recorded for "${staffName ?? ""}".`;
      return action === "create"
        ? `Loan of ${loanAmount ?? 0} created for "${staffName ?? ""}".`
        : action === "update"
          ? `Loan for "${staffName ?? ""}" updated. Amount: ${loanAmount ?? 0}.`
          : `Loan of ${loanAmount ?? 0} for "${staffName ?? ""}" deleted.`;
    case "stock_adjustments":
      return action === "create"
        ? `Stock adjustment recorded for "${productName ?? ""}". Quantity: ${quantity ?? 0}.`
        : action === "update"
          ? `Stock adjustment updated for "${productName ?? ""}".`
          : `Stock adjustment deleted for "${productName ?? ""}".`;
    case "vendors":
      return action === "create"
        ? `Vendor "${vendorName ?? ""}" created.`
        : action === "update"
          ? `Vendor "${vendorName ?? ""}" updated.`
          : `Vendor "${vendorName ?? ""}" deleted.`;
    default:
      if (action === "confirm") return `${label} confirmed.`;
      return `${label} ${action}d.`;
  }
}
type ChangeSet = Record<string, { old: unknown; new: unknown }>;

type AuditChanges = Record<string, ChangeSet>;
export async function emitAuditJournal(options: {
  client: PoolClient;
  entityId: number;
  entityType: string;
  companyId: number;
  tableName: string;
  tableRowId: number | string;
  action: "create" | "update" | "delete" | "confirm" | "repay";
  record: Record<string, any>;
  changes?: AuditChanges | null;
}) {

  const journal = new JournalController();
  const shortTableName = toShortTableName(options.tableName);

  return journal.newJournal({
    company_id: options.companyId,
    entity_id: options.entityId,
    entity_type: options.entityType,
    journal: buildJournalMessage(options.tableName, options.action, options.record),
    table_name: shortTableName,
    table_row_id: options.tableRowId,
    changes: options.changes ?? null,
  }, options.client);
}



export const PARENT_NAME_MAP: Record<string, ParentConfig> = {
  company_id: {
    table: "company",
    nameColumn: "company_name",
  },

  branch_id: {
    table: "branches",
    nameColumn: "branch_name",
    businessColumn: "company_id",
  },

  firm_id: {
    table: "firm",
    nameColumn: "firm_name",
    businessColumn: "branch_id",
  },

  ledger_category_id: {
    table: "ledger_categories",
    nameColumn: "name",
  },

  staff_id: {
    table: "staff",
    nameColumn: "full_name",
  },

  partner_id: {
    table: "partners_info",
    nameColumn: "name",
  },

  payment_method_id: {
    table: "payment_methods",
    nameColumn: "method_name",
  },

  product_category_id: {
    table: "product_categories",
    nameColumn: "name",
  },

  parent_id: {
    table: "product_categories",
    nameColumn: "name",
  },

  brand_id: {
    table: "brand",
    nameColumn: "name",
  },

  vendor_id: {
    table: "vendors",
    nameColumn: "vendor_name",
  },

  purchase_id: {
    table: "purchases",
    nameColumn: "bill_number",
  },

  product_id: {
    table: "products",
    nameColumn: "name",
  },

  stock_id: {
    table: "stock",
    nameColumn: "batch_number",
  },

  purchase_return_id: {
    table: "purchase_return",
    nameColumn: "return_number",
  },

  customer_id: {
    table: "customers",
    nameColumn: "customer_name",
  },

  quotation_id: {
    table: "quotations",
    nameColumn: "invoice_number",
  },

  rent_stock_id: {
    table: "rental_stocks",
    nameColumn: "unique_name",
  },

  sale_id: {
    table: "sales",
    nameColumn: "invoice_number",
  },

  sale_return_id: {
    table: "sale_return",
    nameColumn: "return_number",
  },
};
