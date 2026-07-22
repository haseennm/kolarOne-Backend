import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import MaintenanceController from './maintenance.controller'

interface ClearBody {
  tables?: string[]
}

export async function maintenanceRouter(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ClearBody }>('/', async (request: FastifyRequest<{ Body: ClearBody }>, reply: FastifyReply) => {
    const controller = new MaintenanceController()
    const result = await controller.clearTables({
      tables: request.body?.tables,
    })

    return reply.code(200).send({
      status: 'Success',
      data: result,
    })
  })
}
