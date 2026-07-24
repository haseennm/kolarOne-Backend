import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fs from "fs";
import { pipeline } from "stream/promises";
import { BranchLoginBody, CreateBranchBody, DeleteBranchBody, EditBranchBody, FetchBranchBody } from './branch.types';
import BranchController from './branch.controller';
import path from 'path';
import { AppError } from '../../utils/AppError';

export async function branchRouter(app: FastifyInstance): Promise<void> {
    app.post("/create", async (request, reply) => {

        const parts = request.parts();
        const body: any = {};
        let logoPath: string | null = null;
        let fullPath: string | null = null;
        try {
            for await (const part of parts) {
                if (part.type === "file") {
                    const uploadDir = path.join(process.cwd(), "uploads");
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }
                    const fileName = `${Date.now()}-${part.filename}`;
                    fullPath = path.join(uploadDir, fileName);
                    await pipeline(part.file, fs.createWriteStream(fullPath));
                    logoPath = `/uploads/${fileName}`;
                } else {
                    body[part.fieldname.trim()] = part.value;
                }
            }
            const required = [
                "company_id",
                "branch_code",
                "branch_name",
                "gstin",
                "pan_number",
                "address",
                "city",
                "district",
                "state",
                "state_code",
                "pincode",
                "status",
                "name_of_manager",
                "phone_number",
                "email",
                "created_by",
                "username",
                "password",
                "role"
            ];

            for (const field of required) {
                if (!body[field]) {
                    throw new Error(`${field} is required`);
                }
            }

            body.company_id = Number(body.company_id);
            body.state_code = Number(body.state_code);
            body.pincode = Number(body.pincode);
         
            if (body.role) {
                try {
                    body.role = JSON.parse(body.role);
                } catch {
                    body.role = [];
                }
            }
            const controller = new BranchController();

            const result = await controller.createBranch({
                ...body,
                logo: logoPath
            });
            return reply.code(201).send({
                status: "Success",
                message: result
            });

        } catch (error: any) {

            if (fullPath && fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
            throw error
        }
    });
    app.post<{ Body: FetchBranchBody }>(
        '/get',
        {
            schema: {
                body: {
                    type: 'object',
                    // required : ["company_id"],
                    properties: {
                        page: { type: 'number', minimum: 1 },
                        limit: { type: 'number', minimum: 1 },
                        id: { type: 'number' },
                        company_id: { type: 'number', minimum: 1 },
                        search: { type: ['string', 'null'] }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Body: FetchBranchBody }>, reply: FastifyReply) => {
            const { page = 1, limit = 10, ...filters } = request.body;
            const offset = (page - 1) * limit;
            const controller = new BranchController();
            const companies = await controller.fetchBranch({
                offset,
                filters: {
                    ...filters,
                    page,
                    limit
                }
            });
            return reply.code(200).send(companies);

         
        }
    );

    app.post<{ Body: EditBranchBody }>("/edit", async (request, reply) => {

        const parts = request.parts();
        const body: any = {};
        let logoPath: string | null = null;
        let fullPath: string | null = null;
        try {
            for await (const part of parts) {
                if (part.type === "file") {
                    if (!part.filename) continue;
                    const uploadDir = path.join(process.cwd(), "uploads");
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }
                    const fileName = `${Date.now()}-${part.filename}`;
                    fullPath = path.join(uploadDir, fileName);
                    await pipeline(part.file, fs.createWriteStream(fullPath));
                    logoPath = `/uploads/${fileName}`;
                } else {
                    body[part.fieldname.trim()] = part.value;
                }
            }
            if (!body.id) {
                throw new AppError("id is required",500);
            }
            if (!body.updated_by) {
                throw new AppError("updated_by is required",500);
            }
            if (!body.company_id) {
                throw new AppError("company_id is required",500);
            }
            
            if (body.role) {
                try {
                    body.role = JSON.parse(body.role);
                } catch {
                    body.role = [];
                }
            }
            if (logoPath) {
                body.logo = logoPath;
            }

            const controller = new BranchController();
            const result = await controller.editBranch(body);

            return reply.code(200).send({
                status: "Success",
                message: result
            });

        } catch (error: any) {

            if (fullPath && fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
            throw error
        }
    });
    app.post<{ Body: DeleteBranchBody }>(
        '/delete',
        {
            schema: {
                body: {
                    type: 'object',
                    required: [
                        'r_id',
                        'deleted_by',
                        "company_id"
                    ],
                    properties: {
                        r_id: { type: 'number' },
                        company_id: { type: 'number' },
                        deleted_by: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            const controller = new BranchController()
            const branch = await controller.deleteBranch(request.body)
            return reply.code(201).send(branch)

        
        }
    )

    app.post<{ Body: BranchLoginBody }>(
        "/login",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["password", "username"],
                    properties: {
                        password: { type: "string" },
                        username: { type: "string" },
                    },
                },
            },
        },
        async (request, reply) => {
            const controller = new BranchController();
            const firm = await controller.loginBranch(request.body);
            return reply.code(201).send(firm);
        
        }
    );


}


