import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CompanyLoginBody, CreateCompanyBody, DeleteCompanyBody, EditCompanyBody, GetCompanyBody } from './company.types'
import CompanyController from './company.controller'
import { cns, el } from '../../utils/extra';
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

export async function companyRoutes(app: FastifyInstance): Promise<void> {
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

            // ✅ Required Fields
            const required = [
                "company_name",
                "bussiness_category",
                "address",
                "city",
                "district",
                "state",
                "state_code",
                "status",
                "created_by",
                "phone_number",
                "username",
                "password"
            ];

            for (const field of required) {
                if (!body[field]) {
                    throw new Error(`${field} is required`);
                }
            }

            body.created_by = Number(body.created_by);
            const controller = new CompanyController();

            const result = await controller.createCompany({
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

            return reply.status(400).send({
                status: "Error",
                message: error.message || "Company creation failed"
            });
        }
    });
    app.post<{ Body: GetCompanyBody }>(
        '/get',
        {
            schema: {
                body: {
                    type: 'object',
                    properties: {
                        page: { type: 'number', minimum: 1 },
                        limit: { type: 'number', minimum: 1 },
                        id: { type: 'number' },
                        search: { type: ['string', 'null'] }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Body: GetCompanyBody }>, reply: FastifyReply) => {
            try {
                cns(request.url, request.body)
                const { page = 1, limit = 10, ...filters } = request.body;
                const offset = (page - 1) * limit;
                const controller = new CompanyController();
                const companies = await controller.getCompany({
                    offset,
                    filters: {
                        ...filters,
                        page,
                        limit
                    }
                });
                console.log(companies)

                return reply.code(200).send(companies);

            } catch (err: any) {
                el(err)
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    );

   app.post<{ Body: EditCompanyBody }>("/edit", async (request, reply) => {

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
            throw new Error("id is required");
        }

        if (!body.updated_by) {
            throw new Error("updated_by is required");
        }

        body.id = Number(body.id);
        body.updated_by = Number(body.updated_by);

        if (logoPath) {
            body.logo = logoPath;
        }

        const controller = new CompanyController();
        const company = await controller.editCompany(body);

        return reply.code(200).send({
            status: "Success",
            message: company
        });

    } catch (err: any) {

        // delete uploaded file if error happens
        if (fullPath && fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        return reply.status(400).send({
            status: "Error",
            message: err.message || "Company update failed"
        });
    }
});
    app.post<{ Body: DeleteCompanyBody }>(
        '/delete',
        {
            schema: {
                body: {
                    type: 'object',
                    required: [
                        'r_id',
                        'deleted_by'
                    ],
                    properties: {
                        r_id: { type: 'number' },
                        deleted_by: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                cns(request.url, request.body)
                const controller = new CompanyController()
                const company = await controller.deleteCompany(request.body)
                return reply.code(201).send(company)

            } catch (err: any) {
                el(err)
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    )


    app.post<{ Body: CompanyLoginBody }>(
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
            try {
                cns(request.url, request.body);
                const controller = new CompanyController();
                const firm = await controller.loginCompany(request.body);
                return reply.code(201).send(firm);
            } catch (err: any) {
                el(err);
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    );

}


