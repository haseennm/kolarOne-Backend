export interface StaffCreate {
    name: string,
    email: string
}
export interface GetStaffsBody {
    page?: number
    limit?: number
    email?: string
    name?: string
    id?: number
}
export interface GetStaffParams {
    limit: number, offset: number, filters: GetStaffsBody
}