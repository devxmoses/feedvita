import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus,} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../../generated/prisma/client';

@Catch()
export class CatchEveryFilter implements ExceptionFilter {
    constructor(private readonly httpAdapterHost: HttpAdapterHost) {}
    catch(exception: unknown, host: ArgumentsHost): void {
        const { httpAdapter } = this.httpAdapterHost;
        const ctx = host.switchToHttp();
        let httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        let message : string | object = 'Internal server error';

        if(exception instanceof HttpException){
            httpStatus = exception.getStatus();
            const response = exception.getResponse();
            message = typeof response === 'object' && response !== null && 'message' in response 
             ? (response as {message: string | object }).message
              : exception.message;

        }
        else if(exception instanceof Prisma.PrismaClientKnownRequestError){
            switch(exception.code){
                case 'P2002':{
                    const fields = (exception.meta as any)?.driverAdapterError?.cause?.constraint?.fields;
                    httpStatus = HttpStatus.CONFLICT;
                    message = `Unique constraint failed on the fields: ${Array.isArray(fields) ? fields.join(',') : 'unknown field'}`;
                    break;
                }
                case 'P2025':
                    httpStatus = HttpStatus.NOT_FOUND;
                    message = `${(exception.meta as any)?.modelName ?? 'Record'} not found`;
                    break;
                case 'P2003':{
                    const constraintName= (exception.meta as any)?.driverAdapterError?.cause?.constraint?.index;
                    httpStatus = HttpStatus.BAD_REQUEST;
                    message = `Foreign key constraint failed on the field: ${constraintName ??  'unknown field'}`;
                    break;
                }
                default:
                    httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
                    message = `Database error: ${exception.message}`;
            }
        }
        else{
            console.error('Unexpected error:', exception);
        }    

        const responseBody = {
            statusCode: httpStatus,
            timestamp: new Date().toISOString(),
            path: httpAdapter.getRequestUrl(ctx.getRequest()),
            message,
        }

        httpAdapter.reply(ctx.getResponse(),responseBody, httpStatus);

    }
}