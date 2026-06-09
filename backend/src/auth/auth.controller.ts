import {Body, Controller, HttpCode, Post} from '@nestjs/common';
import {AuthService} from './auth.service';
import {RegisterDto} from './dto/register.dto';

interface RegisterResponse {
  userId: string;
  devMode: boolean;
  /** The confirmation link, surfaced for the dev-mode post-registration page. */
  confirmationUrl?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    const result = await this.auth.register(dto.email, dto.password);
    const devMode = process.env.DEV_MODE_CONFIRMATION !== 'false';
    return {
      userId: result.userId,
      devMode,
      confirmationUrl: devMode ? result.confirmationUrl : undefined,
    };
  }
}
