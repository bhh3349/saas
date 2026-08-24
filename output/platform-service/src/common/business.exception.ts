import { HttpException, HttpStatus } from '@nestjs/common';

/** 业务异常：message 直接对前端展示，HTTP 状态默认 400 */
export class BusinessException extends HttpException {
  constructor(message: string, status: number = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}
