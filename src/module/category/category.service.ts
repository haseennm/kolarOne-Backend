import { PoolClient } from 'pg'
import { CategoryCreate } from './category.types'
import { executeInTransaction, transaction } from '../../config/db'

export class CategoryService {

  async createCategory(
    data: CategoryCreate,
    imageUrl: string | null
  ): Promise<{ category_id: number }> {

    return transaction(async (client: PoolClient) => {

      // 🔹 Check parent exists
      if (data.parent_id && data.parent_id !== 0) {
        const checkQuery = `
          SELECT id FROM categories
          WHERE id = $1 AND client_id = $2
        `
        const checkResult = await executeInTransaction(
          client,
          checkQuery,
          [data.parent_id, data.client_id]
        )

        if (checkResult.rowCount === 0) {
          throw new Error('Invalid parent_id')
        }
      }

      // 🔹 Prepare remarks JSON
      const remarks = [
        {
          remark: data.remark || 'created category',
          date: new Date().toISOString(),
          action: 'Created',
          action_by: data.created_by
        }
      ]

      // 🔹 Insert category
      const insertQuery = `
        INSERT INTO categories
        (name, client_id, parent_id, image_url, description, remarks, status, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
      `

      const insertResult = await executeInTransaction<{ id: number }>(
        client,
        insertQuery,
        [
          data.name,
          data.client_id || 0,
          data.parent_id || null,
          imageUrl,
          data.description || null,
          JSON.stringify(remarks),
          data.status || 'Active',
          data.created_by
        ]
      )

      if (insertResult.rowCount === 0) {
        throw new Error('Category insert failed')
      }

      return {
        category_id: insertResult.rows[0].id
      }
    })
  }
}
