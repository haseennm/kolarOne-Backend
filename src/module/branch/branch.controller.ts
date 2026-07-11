import { transaction } from '../../config/db'
import { AppError } from '../../utils/AppError'
import { generateToken, hashPassword, verifyPassword } from '../../utils/auth.util'
import { getStatusCode, getStatusText } from '../../utils/extra'
import { emitAuditJournal } from '../journal/journal.utils'
import BranchService from './branch.service'
import { BranchLoginBody, CreateBranchBody, DeleteBranchBody, EditBranchBody, FetchBranchParams } from './branch.types'

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
        return transaction(async (client) => {
            const { created_by, status, password, ...rest } = data;
            const hashed = await hashPassword(password)

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
                statusCode,
                hashed
            });

            await emitAuditJournal({
                client,
                entityId: branch.id,
                entityType: "B",
                companyId: data.company_id,
                tableName: "branches",
                tableRowId: branch.id,
                action: "create",
                record: branch,
            });

            return branch;
        });
    }
    async editBranch(data: EditBranchBody) {
        return transaction(async (client) => {
            const { id, updated_by, status, ...rest } = data;

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

            const { data: branch, changes } = await service.updateBranch({
                id,
                ...rest,
                remark,
                statusCode,
            });

            await emitAuditJournal({
                client,
                entityId: branch.id,
                entityType: "B",
                companyId: data.company_id,
                tableName: "branches",
                tableRowId: branch.id,
                action: "update",
                record: branch,
                changes:{branch:changes},
            });

            return { data: branch, changes };
        });
    }
    async deleteBranch(data: DeleteBranchBody) {
        return transaction(async (client) => {
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

            await emitAuditJournal({
                client,
                entityId: branch.id,
                entityType: "B",
                companyId: data.company_id,
                tableName: "branches",
                tableRowId: branch.id,
                action: "delete",
                record: branch,
            });

            return branch;
        });
    }

    async loginBranch(data: BranchLoginBody) {
        const { password, username } = data
        const service = new BranchService();
        const branch = await service.loginBranch(data);
        if (!branch) {
            throw new AppError('Branch not found', 401)
        }
        const isValid = await verifyPassword(password, branch.password)

        if (!isValid) {
            throw new AppError('Invalid credentials', 401)
        }

        const token = generateToken({
            id: branch.id,
            username: username,
        })

        return {
            token: token,
            company_id: branch.company_id,
            message: `branch ${branch.branch_name} Login success`,
            role: branch.role,
            state: branch.state,
            name: branch.branch_name
        }
    }
}
