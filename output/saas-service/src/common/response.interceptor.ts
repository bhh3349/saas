import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Readable } from 'stream';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 统一响应格式 { code, message, data }，code === 0 表示成功 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        // 文件流 / 二进制响应（如导出文件下载）保持原样，其余统一包装
        if (data instanceof Buffer || data instanceof Readable) {
          return data;
        }
        return { code: 0, message: 'ok', data };
      }),
    );
  }
}
