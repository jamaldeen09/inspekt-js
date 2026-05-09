import { RequestHandler } from 'express';
import Inspekt from "../core.js"

const inspektExpress = (inspekt: Inspekt): RequestHandler => {
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


export default inspektExpress