import { CreateCompanyBody, EditCompanyBody, GetCompanyParams } from './company.types'
import CompanyService from './company.service'
import { getStatusCode, getStatusText } from '../../utils/extra'

export default class CompanyController {

  async getCompany(data: GetCompanyParams) {
    const service = new CompanyService()
    const companyWithCode = await service.getCompany(data)
    const company = companyWithCode.company.map((row) => ({
      ...row,
      status: getStatusText(row.status)
    }))

    return {
      pagination: {
        page: companyWithCode.page,
        limit: companyWithCode.limit,
        total: companyWithCode.total
      },
      data: {
        // ...company,
        company: company
      }
    }
  }
  async createCompany(data: CreateCompanyBody) {
    const { created_by, status, ...rest } = data;

    const remark = {
      action: "Created",
      created_by,
      created_at: Date.now(),
    };
    const statusCode = getStatusCode(status)
    const service = new CompanyService();

    const company = await service.createCompany({
      ...rest,
      remark,
      statusCode
    });

    return company;
  }
  async editCompany(data: EditCompanyBody) {
    const { updated_by, status, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };

    const statusCode = getStatusCode(status)
    const service = new CompanyService();

    const company = await service.updateCompany({
      ...rest,
      remark,
      statusCode
    });
    return company;
  }

}
