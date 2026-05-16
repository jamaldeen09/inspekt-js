import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Inject,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class InspektInterceptor implements NestInterceptor {
    constructor(@Inject("INSPEKT") private readonly inspekt: any) {
        if (!this.inspekt) {
            console.error("\x1b[31m%s\x1b[0m", "[inspekt] NestJS Error: The 'INSPEKT' provider is missing.");
            console.error("Ensure you have registered the Inspekt instance in your module providers:");
            console.error("\x1b[36m%s\x1b[0m", "  { provide: 'INSPEKT', useValue: new Inspekt({ ... }) }");
            process.exit(1);
        }
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const startTime = performance.now();
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest();
        const response = httpContext.getResponse();
        return next.handle().pipe(
            tap((body) => {
                const responseTime = Math.round(performance.now() - startTime);
                this.inspekt.newAnalysis({
                    req: request,
                    res: response,
                    responseBody: body,
                    responseHeaders: response.getHeaders(),
                    responseTime,
                });
            }),
            catchError((err) => {
                const responseTime = Math.round(performance.now() - startTime);
                const status = err.status || err.statusCode || 500;
                response.statusCode = status;

                this.inspekt.newAnalysis({
                    req: request,
                    res: response, 
                    responseBody: err,
                    responseHeaders: response.getHeaders(),
                    responseTime,
                    status,
                });

                return throwError(() => err);
            })
        );
    }
}