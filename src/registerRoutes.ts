import { FastifyInstance } from 'fastify'

import { productCategoryRouter } from './module/productCategory/proCat.router'
import { companyRoutes } from './module/company/company.router'
import { branchRouter } from './module/branch/branch.router'
import { firmRouter } from './module/firm/firm.router'

export default async function registerRoutes(app: FastifyInstance) {
  app.register(companyRoutes, { prefix: '/company' })
  app.register(branchRouter, { prefix: '/branch' })
  app.register(firmRouter, { prefix: '/firm' })
  app.register(productCategoryRouter, { prefix: '/product/category' })
}