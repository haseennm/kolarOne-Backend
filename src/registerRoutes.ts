import { FastifyInstance } from 'fastify'

import { companyRoutes } from './module/company/company.router'
import { branchRouter } from './module/branch/branch.router'
import { firmRouter } from './module/firm/firm.router'
import { productCategoryRouter } from './module/productCategory/proCat.router'
import { productRouter } from './module/product/product.router'
import { brandRouter } from './module/brand/brand.router'
import { customerRouter } from './module/customer/customer.router'
import { vendorRouter } from './module/vendor/vendor.router'
import { ledgerCategoryRouter } from './module/ledgerCategory/ledgerCategory.router'
import { ledgerTransactionRouter } from './module/ledgertransaction/ledgertransaction.router'
import { paymentMethodRouter } from './module/paymentmethod/paymentMethod.router'
import { roleRouter } from './module/role/role.router'
import { staffRouter } from './module/staff/staff.router'

export default async function registerRoutes(app: FastifyInstance) {
  app.register(companyRoutes, { prefix: '/company' })
  app.register(branchRouter, { prefix: '/branch' })
  app.register(firmRouter, { prefix: '/firm' })
  app.register(productCategoryRouter, { prefix: '/product/category' })
  app.register(productRouter, { prefix: '/product' })
  app.register(brandRouter, { prefix: '/brand' })
  app.register(customerRouter, { prefix: '/customer' })
  app.register(vendorRouter, { prefix: '/vendor' })
  app.register(ledgerCategoryRouter, { prefix: '/ledger/category' })
  app.register(ledgerTransactionRouter, { prefix: '/ledger/transaction' })
  app.register(paymentMethodRouter, { prefix: '/payment/method' })
  app.register(roleRouter, { prefix: '/role' })
  app.register(staffRouter, { prefix: '/staff' })
}