import { PoolClient } from "pg";
import JournalService from "./journal.service";
import { JournalCreate, FetchJournalParams, JournalDetailed } from "./journal.types";
import { getStatusText, toFullTableName } from "../../utils/extra";
import { PARENT_NAME_MAP } from "./journal.utils";

export class JournalController {
  async newJournal(data: JournalCreate, client: PoolClient) {
    const journal = new JournalService()
    const createJournal = journal.createJournal(data, client)
    return createJournal;
  }
  async fetchJournal(data: FetchJournalParams) {
    const journal = new JournalService()
    const fetchJournal = journal.fetchJournal(data)
    return fetchJournal;
  }
  async fetchJournalDetail(data: JournalDetailed) {
    const { table_name, ...rest } = data;
    const journal = new JournalService();
    const fullTableName = toFullTableName(table_name);
    const result = await journal.journalDetailed({
      table_name: fullTableName,
      ...rest,
    });
    const items = Array.isArray(result) ? result : [result];

    const formatted = await Promise.all(
      items.map(async (item: any) => {
        const newItem = { ...item };

        for (const key of Object.keys(PARENT_NAME_MAP)) {
          if (newItem[key] != null) {
            const name = await journal.getParentName(
              key,
              newItem[key],
              null,
              newItem.firm_id ?? null
            );

            newItem[key.replace("_id", "_name")] = name;
            delete newItem[key];
          }
        }

        if (newItem.status !== undefined) {
          newItem.status = getStatusText(newItem.status);
        }
        delete newItem.remarks;
        return newItem;
      })
    );

    return Array.isArray(result) ? formatted : formatted[0];
  }

}