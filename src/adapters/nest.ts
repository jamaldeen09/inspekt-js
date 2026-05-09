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
export default class InspektInterceptor implements NestInterceptor {
    constructor(@Inject("INSPEKT") private readonly inspekt: any) { }

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