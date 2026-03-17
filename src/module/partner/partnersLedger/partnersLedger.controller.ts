
import { convertEntityType, EntityKey, getStatusCode, getStatusText } from "../../../utils/extra";
import CapitalLedgerService from "./partnersLedger.service";
import {
  LEDGER_TYPE_MAP,
  CreateCapitalLedgerBody,
  EditCapitalLedgerBody,
  DeleteCapitalLedgerBody,
  LedgerKey,
  FetchLedgerRequest
} from "./partnersLedger.types";

export default class CapitalLedgerController {
  private service = new CapitalLedgerService();

  async createEntry(data: CreateCapitalLedgerBody) {
    const { created_by, status, flow_type, entity_type, ...rest } = data;
    const remark = { action: "Created", created_by, created_at: Date.now() };
    const statusCode = getStatusCode(status);
    const dbEntryType = LEDGER_TYPE_MAP[flow_type];
    const dbEntityType = convertEntityType(entity_type as EntityKey);

    return this.service.createEntry({
      ...rest,
      flow_type: dbEntryType,
      remark,
      entity_type: dbEntityType,
      statusCode
    });
  }

  async fetchEntries(data: FetchLedgerRequest) {
    const { flow_type, entity_type, ...filters } = data;

    const dbEntryType = flow_type
      ? LEDGER_TYPE_MAP[flow_type as LedgerKey]
      : undefined;
    const dbEntityType = entity_type
      ? convertEntityType(entity_type as EntityKey)
      : undefined;

    const result = await this.service.fetchEntries({
      ...filters,
      flow_type: dbEntryType,
      entity_type: dbEntityType
    });

    const dataList = result.rows.map((r: any) => {
      const entryLabel = (Object.keys(LEDGER_TYPE_MAP) as LedgerKey[])
        .find(key => LEDGER_TYPE_MAP[key] === r.flow_type);

      return {
        ...r,
        flow_type: entryLabel,
        status: getStatusText(r.status)
      };
    });

    return {
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      },
      data: dataList
    };
  }

  async editEntry(data: EditCapitalLedgerBody) {
    const { updated_by, entity_type, status, ...rest } = data;
    const remark = { action: "Updated", updated_by, updated_at: Date.now() };
    let statusCode;
    if (status) statusCode = getStatusCode(status);
    const dbEntityType = convertEntityType(entity_type as EntityKey);

    return this.service.updateEntry({ ...rest, remark, statusCode, entity_type: dbEntityType });
  }

async deleteEntry(data: DeleteCapitalLedgerBody) {
  const { deleted_by, ...rest } = data;

  const remark = {
    action: "Deleted",
    deleted_by,
    deleted_at: Date.now()
  };

  const result = await this.service.deleteEntry({ ...rest, remark });

  const entryLabel =
    (Object.keys(LEDGER_TYPE_MAP) as LedgerKey[])
      .find(key => LEDGER_TYPE_MAP[key] === result.flow_type) ?? "Entry";

  return {
    message: `${entryLabel} of ${result.amount} has been deleted`
  };
}
}