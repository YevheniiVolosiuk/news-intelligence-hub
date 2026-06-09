import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {CLOCK} from '../common/utils/clock';
import {ConfirmationTokensRepository} from './confirmation-tokens.repository';
import {CONFIRMATION_LINK_NOTIFIER} from './confirmation-link-notifier';
import {DevModeConfirmationLinkNotifier} from './dev-mode-confirmation-link-notifier';
import {JwtAuthGuard} from '../common/guards/jwt-auth.guard';
import {LoginService} from './login.service';
import {PasswordHasher} from './password-hasher';
import {SessionService} from './session.service';
import {UsersRepository} from './users.repository';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginService,
    SessionService,
    UsersRepository,
    ConfirmationTokensRepository,
    PasswordHasher,
    {
      provide: CONFIRMATION_LINK_NOTIFIER,
      useClass: DevModeConfirmationLinkNotifier,
    },
    {provide: CLOCK, useFactory: () => () => new Date()},
    {provide: APP_GUARD, useClass: JwtAuthGuard},
  ],
})
export class AuthModule {}
