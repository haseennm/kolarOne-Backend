import { getStatusCode, getStatusText } from "../../utils/extra";
import LedgerCategoryService from "./ledgerCategory.service";
import { CreateLedgerCategoryBody, DeleteLedgerCategoryBody, EditLedgerCategoryBody } from "./ledgerCategory.types";

export default class LedgerCategoryController {

  service = new LedgerCategoryService();

  async createCategory(data: CreateLedgerCategoryBody) {
 
     const { created_by, status, ...rest } = data;
 
     const remark = {
       action: "Created",
       created_by,
       created_at: Date.now(),
     };
 
     const statusCode = getStatusCode(status);
 
     const service = new LedgerCategoryService();
 
     const category = await service.createLedgerCategory({
       ...rest,
       remark,
       statusCode,
     });
 
     return category;
   }

  async fetchCategory(data: any) {
 
     const service = new LedgerCategoryService();
 
     const category_with_code = await service.fetchLedgerCategory(data);
 
     const category = category_with_code.categories.map((row) => ({
       ...row,
       status: getStatusText(row.status),
     }));
     return {
       category,
       pagination: { ...category_with_code.pagination }
     }
   }

async editCategory(data: EditLedgerCategoryBody) {

    const { updated_by, status, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };

    let statusCode =99;

    if (typeof status === "string") {
      statusCode = getStatusCode(status);
    }

    const service = new LedgerCategoryService();

    const category = await service.updateLedgerCategory({
      ...rest,
      remark,
      statusCode,
    });

    return category;
  }

  async deleteCategory(data: DeleteLedgerCategoryBody) {
   const { deleted_by, ...rest } = data;
  
      const remark = {
        action: "Deleted",
        deleted_by,
        updated_at: Date.now(),
      };
  
      const service = new LedgerCategoryService();
  
      const ledger_cat = await service.deleteLedgerCategory({
        ...rest,
        remark,
      });
  
      return ledger_cat;
    }
}