import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CompanyLoginBody, CreateCompanyBody, DeleteCompanyBody, EditCompanyBody, GetCompanyBody } from './company.types'
import CompanyController from './company.controller'
import { cns, el } from '../../utils/extra';

export async function companyRoutes(app: FastifyInstance): Promise<void> {
    app.post<{ Body: CreateCompanyBody }>(
        '/create',
        {
            schema: {
                body: {
                    type: 'object',
                    required: [
                        'company_name',
                        'bussiness_category',
                        'gstin',
                        'address',
                        'city',
                        'district',
                        'state',
                        'state_code',
                        'status',
                        'created_by',
                        'phone_number',
                        'username',
                        'password'
                    ],
                    properties: {
                        company_name: { type: 'string', minLength: 2 },
                        bussiness_category: { type: 'string', minLength: 2 },

                        tin_number: { type: ['string', 'null'] },
                        gstin: { type: ['string', 'null'] },
                        pan_number: { type: ['string', 'null'] },

                        address: { type: 'string', minLength: 3 },
                        city: { type: 'string', minLength: 2 },
                        district: { type: 'string', minLength: 2 },
                        state: { type: 'string', minLength: 2 },
                        state_code: { type: 'string', minLength: 1 },
                        username: {
                            type: "string",
                            minLength: 2,
                            maxLength: 150,
                        },
                        password: {
                            type: "string",
                            minLength: 2,
                            maxLength: 150,
                        },
                        status: { type: 'string', enum: ["Active", "Inactive"] },

                        created_by: { type: 'string' },

                        phone_number: { type: 'string', minLength: 5 },

                        email: { type: ['string', 'null'], format: 'email' },
                        website: { type: ['string', 'null'] },
                        logo: { type: ['string', 'null'] }
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                cns(request.url, request.body)
                const controller = new CompanyController()
                const company = await controller.createCompany(request.body)
                return reply.code(201).send(company)

            } catch (err: any) {
                el(err)
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    )
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

    app.post<{ Body: EditCompanyBody }>(
        '/edit',
        {
            schema: {
                body: {
                    type: 'object',
                    required: [
                        'id',
                        'updated_by'
                    ],
                    properties: {
                        id: { type: 'number' },
                        company_name: { type: 'string', minLength: 2 },
                        bussiness_category: { type: 'string', minLength: 2 },
                        tin_number: { type: ['string', 'null'] },
                        gstin: { type: ['string', 'null'] },
                        pan_number: { type: ['string', 'null'] },
                        address: { type: 'string', minLength: 3 },
                        city: { type: 'string', minLength: 2 },
                        district: { type: 'string', minLength: 2 },
                        state: { type: 'string', minLength: 2 },
                        state_code: { type: 'string', minLength: 1 },
                        status: { type: 'string', enum: ["Active", "Inactive"] },
                        updated_by: { type: 'string' },
                        phone_number: { type: 'string', minLength: 5 },
                        email: { type: ['string', 'null'], format: 'email' },
                        website: { type: ['string', 'null'] },
                        logo: { type: ['string', 'null'] }
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                cns(request.url, request.body)
                const controller = new CompanyController()
                const company = await controller.editCompany(request.body)
                return reply.code(201).send(company)

            } catch (err: any) {
                el(err)
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    )
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


