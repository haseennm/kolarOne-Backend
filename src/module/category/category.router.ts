import { FastifyInstance } from 'fastify'
import { CategoryController } from './category.controller'
import { CategoryCreate } from './category.types'

export async function categoryRoutes(app: FastifyInstance): Promise<void> {

  const controller = new CategoryController()

  app.post<{ Body: CategoryCreate }>(
    '/category/create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'company_id', 'created_by'],
          properties: {
            name: { type: 'string', minLength: 2 },
            parent_id: { type: 'number', nullable: true },
            description: { type: 'string', nullable: true },
            company_id: { type: 'number' },
            status: { type: 'string', nullable: true },
            created_by: { type: 'number' }
          }
        }
      }
    },
    async (request, reply) => {

      try {

        let imageUrl: string | null = null
        const data = await request.file()

        if (data) {
          const filename = `${Date.now()}-${data.filename}`
          const filepath = `uploads/${filename}`

          await data.toBuffer() // You can save with fs if needed

          imageUrl = `/uploads/${filename}`
        }

        const result = await controller.createCategory(
          request.body,
          imageUrl
        )

        return reply.code(201).send({
          status: 'Success',
          statusCode: 201,
          msg: 'Category Created',
          data: result
        })

      } catch (err: any) {

        app.log.error(err)

        if (err.message === 'Invalid parent_id') {
          return reply.code(400).send({
            message: 'Invalid parent_id'
          })
        }

        return reply.code(500).send({
          message: 'Internal Server Error'
        })
      }
    }
  )
}
