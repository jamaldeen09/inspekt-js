// export { default as Inspekt } from './core.js';
import express from "express";
import Inspekt from "./core.js";
import InspektInterceptor from '@inspekt/js/nest';
import { Module, Controller, Get, UseInterceptors } from '@nestjs/common';
import { NestFactory } from "@nestjs/core";


const inspekt = new Inspekt({
    apiKey: "ins_live_1f1e6a79862c559f273812ec7d02b57a0e389ce1cd98c0bd",
    // 'authorization', 'cookie' and 'set-cookie' are redacted by default.
    redactKeys: ['x-api-secret', 'password', 'ssn'],
});

/**
 * 2. The Controller Binding
 * Applying the Interceptor at the class level ensures 
 * every route within this controller is monitored.
 */
@Controller()
@UseInterceptors(InspektInterceptor)
export class AppController {
    @Get('test-error')
    triggerError() {
        // Inspekt will automatically capture this 500 and stream the diagnosis
        throw new Error("Simulated API failure for Inspekt autopsy");
    }
}

/**
 * 1. The Module Configuration
 * We use a factory to ensure a singleton instance of Inspekt 
 * is available throughout the NestJS DI container.
 */
@Module({
    controllers: [AppController],
    providers: [
        {
            provide: 'INSPEKT',
            useFactory: () => {
                inspekt.connect();
                return inspekt;
            },
        },
    ],
})
class AppModule { }


/**
 * 3. Bootstrap
 */
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(4000);
    console.log('🚀 Server ready at http://localhost:3000');
}
bootstrap();