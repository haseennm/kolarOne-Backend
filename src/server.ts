import Fastify from 'fastify'
import { env } from './utils/env'
import multipart from '@fastify/multipart'
import { companyRoutes } from './module/company/company.router'
import { branchRouter } from './module/branch/branch.router'

const app = Fastify({
    logger: false,
})
app.register(multipart)
app.register(companyRoutes, { prefix: '/company' })
app.register(branchRouter, { prefix: '/branch' })

const start = async () => {
    try {
        await app.listen({ port: Number(env.PORT) })
        console.log(`\x1b[44m Server running on http://localhost:${env.PORT}.. \x1b[0m`);

    } catch (err) {
        // app.log.error(err)
        console.log(err)
        process.exit(1)
    }
}
start()
