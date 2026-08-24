import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/** 全局异常过滤器：统一输出 { code, message, data: null } */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    if (res.headersSent) {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as {
        message?: string | string[];
        error?: string;
      };
      if (typeof body === 'string') {
        message = body;
      } else if (Array.isArray(body.message)) {
        message = body.message.join('；');
      } else if (body.message) {
        message = body.message;
      } else if (body.error) {
        message = body.error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // eslint-disable-next-line no-console
    console.error('[saas-service]', exception);

    res.status(status).json({ code: status, message, data: null });
  }
}
