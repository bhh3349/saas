import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一响应格式 { code, message, data }，code === 0 表示成功。
 * 导出类接口（路径含 /export）直接透传，由 controller 手动写响应。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const req = context.switchToHttp().getRequest();
    if (typeof req.path === 'string' && req.path.includes('/export')) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => ({ code: 0, message: 'ok', data })),
    );
  }
}
