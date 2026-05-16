import Inspekt from '../core.js';
import fp from 'fastify-plugin'

export const inspektFastify = (inspekt: Inspekt) => {
    if (!inspekt) {
        console.error("\x1b[31m%s\x1b[0m", "[inspekt] Implementation Error: The 'inspekt' instance is missing.");
        console.error("You must pass your initialized instance to the plugin:");
        console.error("\x1b[36m%s\x1b[0m", "  const inspektInstance = new Inspekt({ apiKey: '...' });");
        console.error("\x1b[36m%s\x1b[0m", "  fastify.register(inspektFastify(inspektInstance)); \x1b[0m<-- Pass it here");
        process.exit(1);
    }

    return fp((fastify, _, done) => {
        fastify.addHook('onRequest', async (request) => {
            (request as any)._inspektStartTime = performance.now();
        });

        fastify.addHook('preSerialization', async (request, _, payload) => {
            (request as any)._inspektBody = payload;
            return payload;
        });

        fastify.addHook("onResponse", async (request, reply) => {
            const start = (request as any)._inspektStartTime;
            const responseTime = start ? Math.round(performance.now() - start) : 0;
            inspekt.newAnalysis({ 
                req: request, 
                res: reply, 
                responseBody: (request as any)._inspektBody, 
                responseHeaders: reply.getHeaders(),
                responseTime,
            })
        });
        done();
    });
};
