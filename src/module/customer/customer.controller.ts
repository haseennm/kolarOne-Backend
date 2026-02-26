import { GetStaffParams, StaffCreate } from './customer.types'
import StaffService from './customer.service'

export default class StaffController {
   
    async getStaff() {
        const service = new StaffService()
        const staff = await service.getAllStaffs()
        return staff
    }
    async createStaff(data:StaffCreate) {
        const service = new StaffService()
        const staff = await service.createStaff(data)
        return staff
    }
    async getStaffById(data:GetStaffParams) {
        const service = new StaffService()
        const staff = await service.getStaffById(data)
        console.log(staff)
        return staff
    }
}
