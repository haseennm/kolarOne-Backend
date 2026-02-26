export interface CategoryCreate {
  name: string
  parent_id?: number | null
  description?: string | null
  company_id: number
  remark?: string
  status?: string
  created_by: number
}

export interface Category {
  id: number
  name: string
  client_id: number
  parent_id: number | null
  image_url: string | null
  description: string | null
  remarks: any
  status: string
  created_by: number
  created_at: Date
}
