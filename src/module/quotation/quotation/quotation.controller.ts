import { PoolClient } from "pg";
import { ChangeQuotationStatus, QuotationCreateBody, QuotationDeleteBody, QuotationEditBody, QuotationFetchParams } from "./quotation.types";
import { transaction } from "../../../config/db";
import QuotationService from "./quotation.service";
import QuotationItemController from "../quotationItems/quotationItems.controller";
import { getStatusText } from "../../../utils/extra";


export default class QuotationController {

  async QuotationCreate(data: QuotationCreateBody) {
    const {  final_amount, company_id, created_by, items, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {

      const service = new QuotationService();
      const quotation = await service.createQuotation(
        {
          ...rest,
          final_amount,
          remark,
          company_id
        },
        client
      );
      const quotationItem = new QuotationItemController();
      for (const item of items) {
        await quotationItem.createQuotationItem({
          quotation_id: quotation.id,
          firm_id: rest.firm_id,
          status:  "Completed",
          product_id: item.product_id,
          stock_id: item.stock_id,
          quotation_qty: item.quotation_qty,
          unit: item.unit,
          unit_price: item.unit_price,
          sub_total: item.sub_total,
          discount: item.discount ?? 0,
          total_igst: item.total_igst ?? 0,
          total_sgst: item.total_sgst ?? 0,
          total_cgst: item.total_cgst ?? 0,
          net_amount: item.net_amount,
          final_amount: item.final_amount
            ?? (item.net_amount
              - (item.discount ?? 0)
              + (item.total_igst ?? 0)
              + (item.total_sgst ?? 0)
              + (item.total_cgst ?? 0)) // added
        }, client);
      }

      return {
        msg: `Quotation ${quotation.invoice_number} has been created successfully.`,
        id: quotation.id
      };
    });
  }

  async quotationEdit(data: QuotationEditBody) {
    const { final_amount, company_id, updated_by, items, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: new Date(),
    };

    return transaction(async (client: PoolClient) => {

      const service = new QuotationService();
      const quotation = await service.editQuotation(
        {
          ...rest,
          final_amount,
          remark,
          company_id
        },
        client
      );

      const quotationItem = new QuotationItemController();

      // ✅ Edit existing items
      if (items && items.length > 0) {
        for (const item of items) {
          const quotationItemData = await quotationItem.editQuotationItem(
            {
              item_id: item.item_id,
              quotation_id: quotation.id,
              firm_id: rest.firm_id,
              branch_id: rest.branch_id,
              status:  "Completed",
              product_id: item.product_id,
              stock_id: item.stock_id,
              quotation_qty: item.quotation_qty,
              unit: item.unit,
              unit_price: item.unit_price,
              sub_total: item.sub_total,
              discount: item.discount ?? 0,
              total_igst: item.total_igst ?? 0,
              total_sgst: item.total_sgst ?? 0,
              total_cgst: item.total_cgst ?? 0,
              net_amount: item.net_amount,
              final_amount: item.final_amount
                ?? (item.net_amount ?? 0
                  - (item.discount ?? 0)
                  + (item.total_igst ?? 0)
                  + (item.total_sgst ?? 0)
                  + (item.total_cgst ?? 0))
            },
            client
          );
        }
      }

      return `Quotation ${quotation.invoice_number} has been updated successfully.`;
    });
  }

  async QuotationFetch(data: QuotationFetchParams) {

    const service = new QuotationService();

    const quotationWithCode = await service.fetchQuotations(data);

    const quotation = quotationWithCode.quotations.map((row) => ({
      ...row,
      status: getStatusText(row.status),
    }));

    return {
      quotation,
      pagination: { ...quotationWithCode.pagination }
    };
  }
  // async QuotationPurchaseReport(client: PoolClient, data: GetReportquotationPurchaseLedger) {
  //   if (data.level === "Branch") {
  //     if (!data.branch_id) {
  //       throw new AppError("Branch id is required if level is branch", 400)
  //     }
  //   }
  //   if (data.level === "Firm") {
  //     if (!data.branch_id) {
  //       throw new AppError("Firm id is required if level is firm", 400)
  //     }
  //   }
  //   const service = new QuotationService();
  //   const quotationsPurchase = await service.getquotationsPurchaseReport(client, data);
  //   return {
  //     quotationsPurchase
  //   };

  // }
  async fullQuotationFetch(data: QuotationFetchParams) {
    const service = new QuotationService();
    const quotationsWithCode = await service.fetchQuotationsFull(data);
    const quotations = quotationsWithCode.quotations.map((row) => ({
      ...row,

      status: getStatusText(row.status),

      items: row.items?.map((item: any) => ({
        ...item,
        status: getStatusText(item.status),
      })) || [],
    }));

    return {
      quotations,
      pagination: { ...quotationsWithCode.pagination }
    };
  }
  async QuotationDelete(data: QuotationDeleteBody) {
    const { deleted_by, branch_id, ...rest } = data
    transaction(async (client) => {

      const remark = {
        action: `Deleted purchase`,
        deleted_by,
        created_at: Date.now(),
      };
      const quotationService = new QuotationService();
      const itemService = new QuotationItemController();

      const quotation = await quotationService.deleteQuotation({ remark, ...rest }, client);
      const quotation_item = await itemService.deleteQuotationItem(
        {
          quotation_id: rest.id,
          firm_id: rest.firm_id,
        },
        client
      );
   

      return `Quotatioin ${quotation.invoice_number} deleted successfully`
    })
  }
  async QuotationStatusChange(data: ChangeQuotationStatus,client:PoolClient) {
   
      const quotationService = new QuotationService();
      const itemService = new QuotationItemController();

      const quotation = await quotationService.changeQuotationStatus(data, client);
      await itemService.changeQuotationItemStatus(
        {
          quotation_id: data.id,
          firm_id: data.firm_id,
          remark:data.remark,
          status:data.status
        },
        client
      );
   
      return `Quotatioin ${quotation.invoice_number} status changed to ${getStatusText(data.status)} successfully`
    }
  }