import MaintenanceService from './maintenance.service'

export default class MaintenanceController {
  private service: MaintenanceService

  constructor() {
    this.service = new MaintenanceService()
  }

  async clearTables(payload: { tables?: string[] }) {
    return this.service.clearTables(payload)
  }
}
