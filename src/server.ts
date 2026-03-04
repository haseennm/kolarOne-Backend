import Fastify from 'fastify'
import { env } from './utils/env'
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { companyRoutes } from './module/company/company.router'
import { branchRouter } from './module/branch/branch.router'
import { firmRouter } from './module/firm/firm.router'
import path from "path";
import { productCategoryRouter } from './module/productCategory/proCat.router';
import registerRoutes from './registerRoutes';

const app = Fastify({
    logger: false,
})
app.register(multipart, {
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    
});
app.register(fastifyStatic, {
    root: path.join(__dirname, "../uploads"),
    prefix: "/uploads/",
});
// app.register(multipart)
app.register(registerRoutes, { prefix: '/api' });


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
