import {Module} from '@nestjs/common';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {CLOCK} from './clock';
import {ConfirmationTokensRepository} from './confirmation-tokens.repository';
import {CONFIRMATION_LINK_NOTIFIER} from './confirmation-link-notifier';
import {DevModeConfirmationLinkNotifier} from './dev-mode-confirmation-link-notifier';
import {PasswordHasher} from './password-hasher';
import {UsersRepository} from './users.repository';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    ConfirmationTokensRepository,
    PasswordHasher,
    {
      provide: CONFIRMATION_LINK_NOTIFIER,
      useClass: DevModeConfirmationLinkNotifier,
    },
    {provide: CLOCK, useFactory: () => () => new Date()},
  ],
})
export class AuthModule {}
