import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, OperatorPayload } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // 登录失败限流：5 次/分钟（防爆破）
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** 当前运营账号资料 */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: OperatorPayload) {
    return this.authService.getProfile(user.userId);
  }

  /** 修改用户名 / 头像 */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: OperatorPayload, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  /** 修改密码 */
  @Put('password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  changePassword(@CurrentUser() user: OperatorPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }
}
