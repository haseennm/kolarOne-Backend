import { FastifyInstance } from 'fastify'

import { companyRoutes } from './module/company/company.router'
import { branchRouter } from './module/branch/branch.router'
import { firmRouter } from './module/firm/firm.router'
import { recentActivityRouter } from './module/recent-activity/recent-activity.router'
import { productCategoryRouter } from './module/productCategory/proCat.router'
import { productRouter } from './module/product/product.router'
import { brandRouter } from './module/brand/brand.router'
import { customerRouter } from './module/customer/customer.router'
import { vendorRouter } from './module/vendor/vendor.router'
import { ledgerCategoryRouter } from './module/ledgerCategory/ledgerCategory.router'
import { ledgerTransactionRouter } from './module/ledgertransaction/ledgertransaction.router'
import { paymentMethodRouter } from './module/paymentmethod/paymentMethod.router'
import { financialRouter } from './module/financial/financial.router'
import { roleRouter } from './module/role/role.router'
import { stockRouter } from './module/stock/stock.router'
import { staffRouter } from './module/staff/staff.router'
import { attendanceRouter } from './module/attendance/attendance.router'
import { salaryRouter } from './module/salary/salary.router'
import { loanRouter } from './module/loan/loan.router'
import { partnerRouter } from './module/partner/partnerinfo/partnerinfo.router'
import { profitShareRouter } from './module/partner/partnerProfitShare/partnerProfitShare.router'
import { partnerLedgerRouter } from './module/partner/partnersLedger/partnersLedger.router'
import { purchaseRouter } from './module/purchase/purchase/purchase.router'
import { saleReturnRouter } from './module/saleReturn/saleReturn/saleReturn.router'
import { saleRouter } from './module/sale/sale/sale.router'
import { purchaseReturnRouter } from './module/purchaseReturn/purchaseReturn/purchaseReturn.router'
import { partyBalanceRouter } from './module/partyBalance/partyBalance.router'
import { financialYearRouter } from './module/financialYear/financialYear.router'
import { maintenanceRouter } from './module/maintenance/maintenance.router'
import { companyBrandingRouter } from './module/companyBranding/companyBranding.router'
import { todaySnapdealRouter } from './module/todaySnapdeal/todaySnapdeal.router'
import reportRoutes from './module/reports/report.router'

export default async function registerRoutes(app: FastifyInstance) {
  app.register(companyRoutes, { prefix: '/company' })
  app.register(branchRouter, { prefix: '/branch' })
  app.register(firmRouter, { prefix: '/firm' })
  app.register(recentActivityRouter, { prefix: '/recent/activity' })
  app.register(productCategoryRouter, { prefix: '/product/category' })
  app.register(productRouter, { prefix: '/product' })
  app.register(brandRouter, { prefix: '/brand' })
  app.register(customerRouter, { prefix: '/customer' })
  app.register(vendorRouter, { prefix: '/vendor' })
  app.register(ledgerCategoryRouter, { prefix: '/ledger/category' })
  app.register(ledgerTransactionRouter, { prefix: '/ledger/transaction' })
  app.register(paymentMethodRouter, { prefix: '/payment/method' })
  app.register(financialRouter, { prefix: '/financial' })
  app.register(roleRouter, { prefix: '/role' })
  app.register(staffRouter, { prefix: '/staff' })
  app.register(attendanceRouter, { prefix: '/attendance' })
  app.register(salaryRouter, { prefix: '/salary' })
  app.register(loanRouter, { prefix: '/loan' })
  app.register(stockRouter, { prefix: '/stock' })
  app.register(partnerRouter, { prefix: '/partner/personal/info' })
  app.register(profitShareRouter, { prefix: '/partner/profit/info' })
  app.register(partnerLedgerRouter, { prefix: '/partner/ledger/info' })
  app.register(purchaseRouter, { prefix: '/purchase' })
  app.register(purchaseReturnRouter, { prefix: '/purchase/return' })
  app.register(saleRouter, { prefix: '/sale' })
  app.register(saleReturnRouter, { prefix: '/sale/return' })
  app.register(todaySnapdealRouter, { prefix: '/today/snapdeals' })
  app.register(partyBalanceRouter, { prefix: 'balance' })
  app.register(financialYearRouter, { prefix: 'financial/year' })
  app.register(maintenanceRouter, { prefix: '/maintenance' })
  app.register(companyBrandingRouter, { prefix: '/company/branding' })
  app.register(reportRoutes, { prefix: '/reports' })
}