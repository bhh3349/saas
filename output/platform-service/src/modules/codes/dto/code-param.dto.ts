import { Matches } from 'class-validator';

/** 激活码路由参数：12 位字母数字 */
export class CodeParamDto {
  @Matches(/^[A-Za-z0-9]{12}$/, { message: '激活码格式不正确' })
  code: string;
}
