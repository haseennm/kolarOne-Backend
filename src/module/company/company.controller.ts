import { CompanyLoginBody, CreateCompanyBody, DeleteCompanyBody, EditCompanyBody, GetCompanyParams } from './company.types'
import CompanyService from './company.service'
import { getStatusCode, getStatusText } from '../../utils/extra'
import { generateToken, hashPassword, verifyPassword } from '../../utils/auth.util'
import { AppError } from '../../utils/AppError'

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
        company: company
      }
    }
  }
  async createCompany(data: CreateCompanyBody) {
    const { created_by, status, password, ...rest } = data;
    const hashed = await hashPassword(password)

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
      statusCode,
      hashed
    });

    return company;
  }
  async editCompany(data: EditCompanyBody) {

    const { id, updated_by, status, ...rest } = data;

    const remark = {
      action: "Updated",
      updated_by,
      updated_at: Date.now(),
    };

    let statusCode = 99;

    if (typeof status === "string") {
      statusCode = getStatusCode(status);
    }

    const service = new CompanyService();

    const company = await service.updateCompany({
      id,
      ...rest,
      remark,
      statusCode
    });

    return company;
  }
  async deleteCompany(data: DeleteCompanyBody) {
    const { deleted_by, ...rest } = data;

    const remark = {
      action: "Deleted",
      deleted_by,
      updated_at: Date.now(),
    };


    const service = new CompanyService();

    const company = await service.deleteCompany({
      ...rest,
      remark,
    });
    return company;
  }

  async loginCompany(data: CompanyLoginBody) {
    const { password, username } = data
    const service = new CompanyService();
    const company = await service.loginCompany(data);
    const isValid = await verifyPassword(password, company.password)

    if (!isValid) {
      throw new AppError('Invalid credentials', 401)
    }

    const token = generateToken({
      id: company.id,
      username: username,
    })

    return {
      token: token,
      message: `company ${company.company_name} Login success`,
      name: company.company_name
    }
  }
}
