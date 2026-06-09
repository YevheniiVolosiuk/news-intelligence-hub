import {randomBytes, createHash} from 'crypto';
import {ConflictException, Inject, Injectable, Logger} from '@nestjs/common';
import {
  CONFIRMATION_LINK_NOTIFIER,
  ConfirmationLinkNotifier,
} from './confirmation-link-notifier';
import {ConfirmationTokensRepository} from './confirmation-tokens.repository';
import {PasswordHasher} from './password-hasher';
import {EmailAlreadyRegisteredError, UsersRepository} from './users.repository';

export interface RegisterResult {
  userId: string;
  email: string;
  /** Present only in dev mode, for the post-registration page to render. */
  confirmationUrl: string;
}

/** Confirmation tokens are stored as a SHA-256 hash; the raw token only ever travels in the link. */
function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: ConfirmationTokensRepository,
    private readonly hasher: PasswordHasher,
    @Inject(CONFIRMATION_LINK_NOTIFIER)
    private readonly notifier: ConfirmationLinkNotifier,
  ) {}

  async register(email: string, password: string): Promise<RegisterResult> {
    const normalisedEmail = email.trim().toLowerCase();
    const passwordHash = await this.hasher.hash(password);

    let user;
    try {
      user = await this.users.create(normalisedEmail, passwordHash);
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        // Per the approved UX trade-off this is intentionally explicit rather
        // than non-enumerating.
        this.logger.log('register rejected outcome=duplicate-email');
        throw new ConflictException(
          'an account already exists — log in instead',
        );
      }
      throw err;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const ttlHours = Number(process.env.CONFIRMATION_TOKEN_TTL_HOURS ?? 24);
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
    await this.tokens.create(user.id, hashToken(rawToken), expiresAt);

    const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const confirmationUrl = `${baseUrl}/confirm?token=${rawToken}`;

    await this.notifier.notify({
      userId: user.id,
      email: user.email,
      confirmationUrl,
      rawToken,
    });

    this.logger.log(`registered userId=${user.id} outcome=created`);
    return {userId: user.id, email: user.email, confirmationUrl};
  }
}
