
import { getStatusCode, getStatusText } from '../../utils/extra'
import BranchService from './branch.service'
import { CreateBranchBody, DeleteBranchBody, EditBranchBody, FetchBranchParams } from './branch.types'

export default class BranchController {

    async fetchBranch(data: FetchBranchParams) {
        const service = new BranchService()
        const branch_with_code = await service.fetchBranch(data)
        const branch = branch_with_code.branch.map((row) => ({
            ...row,
            status: getStatusText(row.status)
        }))

        return {
            pagination: {
                page: branch_with_code.page,
                limit: branch_with_code.limit,
                total: branch_with_code.total
            },
            data: {
                branch: branch
            }
        }
    }
    async createBranch(data: CreateBranchBody) {
        const { created_by, status, ...rest } = data;

        const remark = {
            action: "Created",
            created_by,
            created_at: Date.now(),
        };
        const statusCode = getStatusCode(status)
        const service = new BranchService();

        const branch = await service.createBranch({
            ...rest,
            remark,
            statusCode
        });

        return branch;
    }
  async editBranch(data: EditBranchBody) {
    const { updated_by, status, ...rest } = data;

    const remark = {
        action: "Updated",
        updated_by,
        updated_at: Date.now(),
    };

    let statusCode;

    if (typeof status === "string") {
        statusCode = getStatusCode(status);
    }

    const service = new BranchService();

    const branch = await service.updateBranch({
        ...rest,
        remark,
        statusCode,
    });

    return branch;
}
    async deleteBranch(data: DeleteBranchBody) {
        const { deleted_by, ...rest } = data;

        const remark = {
            action: "Deleted",
            deleted_by,
            updated_at: Date.now(),
        };

        const service = new BranchService();
        const branch = await service.deleteBranch({
            ...rest,
            remark,
        });
        return branch;
    }

}
