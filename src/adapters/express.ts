import { RequestHandler } from 'express';
import Inspekt from "../core.js"

export const inspektExpress = (inspekt: Inspekt): RequestHandler => {
    if (!inspekt) {
        console.error("\x1b[31m%s\x1b[0m", "[inspekt] Implementation Error: The 'inspekt' instance is missing.");
        console.error("You must pass your initialized instance to the middleware:");
        console.error("\x1b[36m%s\x1b[0m", "  const inspektInstance = new Inspekt({ apiKey: '...' });");
        console.error("\x1b[36m%s\x1b[0m", "  app.use(inspektExpress(inspektInstance)); \x1b[0m<-- Pass it here");
        process.exit(1); 
    }

    return (req, res, next) => {
        const startTime = performance.now(); 
        const originalJson = res.json;
        let capturedBody: any = null;

        res.json = function (body: any) {
            capturedBody = body;
            return originalJson.call(this, body);
        };

        res.on("finish", () => {
            const responseTime = Math.round(performance.now() - startTime);
            inspekt.newAnalysis({
                req,
                res,
                responseBody: capturedBody,
                responseHeaders: res.getHeaders(),
                responseTime
            })
        });
        next();
    };
};
