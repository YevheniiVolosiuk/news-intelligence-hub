import {Body, Controller, Get, HttpCode, Post, Res} from '@nestjs/common';
import {Response} from 'express';
import {AuthService} from './auth.service';
import {CurrentUser} from './current-user.decorator';
import {LoginService} from './login.service';
import {Public} from './public.decorator';
import {AuthenticatedUser, SessionService} from './session.service';
import {ConfirmDto} from './dto/confirm.dto';
import {LoginDto} from './dto/login.dto';
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

interface SafeProfile {
  id: string;
  email: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly loginService: LoginService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
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

  @Public()
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

  @Public()
  @Post('resend-confirmation')
  @HttpCode(200)
  async resendConfirmation(
    @Body() dto: ResendConfirmationDto,
  ): Promise<ResendConfirmationResponse> {
    const result = await this.auth.resendConfirmation(dto.email);
    return {status: result.status, email: result.email};
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({passthrough: true}) res: Response,
  ): Promise<SafeProfile> {
    const result = await this.loginService.login(dto.email, dto.password);
    res.cookie(result.cookie.name, result.cookie.value, result.cookie.options);
    return {id: result.userId, email: result.email};
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): SafeProfile {
    return {id: user.userId, email: user.email};
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({passthrough: true}) res: Response): {status: string} {
    res.cookie(
      this.sessions.getCookieName(),
      '',
      this.sessions.getClearCookieOptions(),
    );
    return {status: 'logged_out'};
  }
}
