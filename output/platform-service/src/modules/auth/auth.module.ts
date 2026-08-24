import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getConfig } from '../../config/env';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Operator } from '../../entities/operator.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Operator]),
    JwtModule.register({
      global: true,
      secret: getConfig().jwtSecret,
      // jwtExpiresIn 为可读字符串（如 '8h'），断言为 jsonwebtoken 的 StringValue 类型
      signOptions: { expiresIn: getConfig().jwtExpiresIn as `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // 导出 TypeOrmModule 使 JwtAuthGuard 的 OperatorRepository 依赖在其它模块可解析
  exports: [AuthService, JwtAuthGuard, TypeOrmModule],
})
export class AuthModule {}
