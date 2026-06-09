import {Body, Controller, HttpCode, Post} from '@nestjs/common';
import {AuthService} from './auth.service';
import {ConfirmDto} from './dto/confirm.dto';
import {RegisterDto} from './dto/register.dto';
import {ResendConfirmationDto} from './dto/resend-confirmation.dto';

interface RegisterResponse {
  userId: string;
  devMode: boolean;
  /** The confirmation link, surfaced for the dev-mode post-registration page. */
  confirmationUrl?: string;
}

interface ConfirmResponse {
  status: string;
  userId?: string;
  email?: string;
}

interface ResendConfirmationResponse {
  status: string;
  email: string;
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

  @Post('confirm')
  @HttpCode(200)
  async confirm(@Body() dto: ConfirmDto): Promise<ConfirmResponse> {
    const result = await this.auth.confirmEmail(dto.token);
    return {
      status: result.status,
      userId: result.userId,
      email: result.email,
    };
  }

  @Post('resend-confirmation')
  @HttpCode(200)
  async resendConfirmation(
    @Body() dto: ResendConfirmationDto,
  ): Promise<ResendConfirmationResponse> {
    const result = await this.auth.resendConfirmation(dto.email);
    return {status: result.status, email: result.email};
  }
}
