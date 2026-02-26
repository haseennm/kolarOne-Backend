import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import UserController from './staff.controller'
import { GetStaffsBody, StaffCreate } from './staff.types'




export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const controller = new UserController()
      const users = await controller.getStaff()
      return users
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ message: 'Internal Server Error' })
    }
  })

  app.post<{ Body: StaffCreate }>(
    '/create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const controller = new UserController()
        const user = await controller.createStaff(request.body)
        return reply.code(201).send(user)

      } catch (err: any) {
        app.log.error(err)

        if (err.code === '23505') {
          return reply.status(409).send({ message: 'Email already exists' })
        }

        return reply.status(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  app.post<{ Body: GetStaffsBody }>(
    '/get',
    async (request, reply) => {
      try {
        const {
          page = 1,
          limit = 10,
          email,
          name,
          id
        } = request.body

        const offset = (page - 1) * limit

        const controller = new UserController()
        const result = await controller.getStaffById({
          limit: Number(limit),
          offset: Number(offset),
          filters: {
            email,
            name,
            id
          }
        })

        if (!result.staffs.length) {
          return reply.status(404).send({ message: 'No staffs found' })
        }

        return reply.code(200).send({
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          staffs: result.staffs
        })

      } catch (err) {
        app.log.error(err)
        return reply.status(500).send({ message: 'Internal Server Error' })
      }
    }
  )
}
