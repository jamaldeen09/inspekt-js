import Inspekt from '../core.js';
import fp from 'fastify-plugin'

const inspektFastify = (inspekt: Inspekt) => {
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

export default inspektFastify