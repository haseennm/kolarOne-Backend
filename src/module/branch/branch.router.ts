import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { cns, el } from '../../utils/extra';
import { CreateBranchBody, DeleteBranchBody, EditBranchBody, FetchBranchBody } from './branch.types';
import BranchController from './branch.controller';

export async function branchRouter(app: FastifyInstance): Promise<void> {
    app.post<{ Body: CreateBranchBody }>(
        '/create',
        {
            schema: {
                body: {
                    type: 'object',
                    required: [
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
                        'created_by',
                    ],
                    properties: {
                        company_id: {
                            type: "integer",
                            minimum: 1
                        },

                        branch_code: {
                            type: "string",
                            minLength: 1,
                            maxLength: 50
                        },

                        branch_name: {
                            type: "string",
                            minLength: 2,
                            maxLength: 150
                        },

                        gstin: {
                            type: "string",
                            minLength: 15,
                            maxLength: 15,
                            pattern: "^[0-9A-Z]{15}$"
                        },

                        pan_number: {
                            type: "string",
                            minLength: 10,
                            maxLength: 10,
                            pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
                        },

                        address: {
                            type: "string",
                            minLength: 5
                        },

                        city: {
                            type: "string",
                            minLength: 2,
                            maxLength: 100
                        },

                        district: {
                            type: "string",
                            minLength: 2,
                            maxLength: 100
                        },

                        state: {
                            type: "string",
                            minLength: 2,
                            maxLength: 100
                        },

                        state_code: {
                            type: "string",
                            minLength: 2,
                            maxLength: 2
                        },

                        pincode: {
                            type: "string",
                            pattern: "^[0-9]{6}$"
                        },

                        status: {
                            type: 'string',
                            enum: ["Active", "Inactive"]
                        },


                        name_of_manager: {
                            type: "string",
                            minLength: 2,
                            maxLength: 150
                        },

                        phone_number: {
                            type: "string",
                            pattern: "^[0-9]{10,15}$"
                        },

                        email: {
                            type: "string",
                            format: "email"
                        },

                        website: {
                            type: "string",
                            format: "uri"
                        },

                        logo: {
                            type: "string"
                        },

                        created_by: {
                            type: "integer",
                            minimum: 1
                        }
                    }
                },
            },
        },
        async (request, reply) => {
            try {
                cns(request.url, request.body)
                const controller = new BranchController()
                const branch = await controller.createBranch(request.body)
                return reply.code(201).send(branch)

            } catch (err: any) {
                el(err)
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    )
    app.post<{ Body: FetchBranchBody }>(
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
        async (request: FastifyRequest<{ Body: FetchBranchBody }>, reply: FastifyReply) => {
            try {
                cns(request.url, request.body)
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

    app.post<{ Body: EditBranchBody }>(
        '/edit',
        {
            schema: {
                body: {
                    type: 'object',
                    required: [
                        'id',
                        'updated_by',
                        'company_id'
                    ],
                    properties: {
                        id: { type: 'number' },
                        company_id: { type: 'number' },
                         

                        address: {
                            type: "string",
                            minLength: 5
                        },

                        city: {
                            type: "string",
                            minLength: 2,
                            maxLength: 100
                        },

                        district: {
                            type: "string",
                            minLength: 2,
                            maxLength: 100
                        },

                        state: {
                            type: "string",
                            minLength: 2,
                            maxLength: 100
                        },

                        state_code: {
                            type: "string",
                            minLength: 2,
                            maxLength: 2
                        },

                        pincode: {
                            type: "string",
                            pattern: "^[0-9]{6}$"
                        },

                        status: {
                            type: 'string',
                            enum: ["Active", "Inactive"]
                        },


                        name_of_manager: {
                            type: "string",
                            minLength: 2,
                            maxLength: 150
                        },

                        phone_number: {
                            type: "string",
                            pattern: "^[0-9]{10,15}$"
                        },

                        email: {
                            type: "string",
                            format: "email"
                        },

                        website: {
                            type: "string",
                            format: "uri"
                        },

                        logo: {
                            type: "string"
                        },
                        updated_by: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                cns(request.url, request.body)
                const controller = new BranchController()
                const branch = await controller.editBranch(request.body)
                return reply.code(201).send(branch)

            } catch (err: any) {
                el(err)
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    )
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
            try {
                cns(request.url, request.body)
                const controller = new BranchController()
                const branch = await controller.deleteBranch(request.body)
                return reply.code(201).send(branch)

            } catch (err: any) {
                el(err)
                return reply
                    .status(err.statusCode || 500)
                    .send({ message: err.message || "Internal Server Error" });
            }
        }
    )




}


