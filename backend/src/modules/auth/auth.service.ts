import {randomBytes, randomUUID, createHash} from 'crypto';
import {
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CONFIRMATION_LINK_NOTIFIER,
  ConfirmationLinkNotifier,
} from './confirmation-link-notifier';
import {CLOCK, Clock} from '../../common/utils/clock';
import {ConfirmationTokensRepository} from './confirmation-tokens.repository';
import {PasswordHasher} from './password-hasher';
import {
  EmailAlreadyRegisteredError,
  UsersRepository,
} from '../users/users.repository';

export interface RegisterResult {
  userId: string;
  email: string;
  /** Present when the notifier surfaces the link (dev mode). */
  confirmationUrl?: string;
}

export type ConfirmStatus = 'confirmed';

export interface ConfirmResult {
  status: ConfirmStatus;
  userId: string;
  email: string;
}

export interface ResendResult {
  status: 'sent';
  email: string;
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
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async register(email: string, password: string): Promise<RegisterResult> {
    const normalisedEmail = email.trim().toLowerCase();
    const passwordHash = await this.hasher.hash(password);

    let user;
    try {
      user = await this.users.create(normalisedEmail, passwordHash);
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        // Non-enumerating: return a synthetic success indistinguishable from
        // a real registration. No notification is sent, no duplicate created.
        this.logger.log('register outcome=duplicate-email (non-enumerating)');
        return {
          userId: randomUUID(),
          email: normalisedEmail,
        };
      }
      throw err;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const ttlHours = Number(process.env.CONFIRMATION_TOKEN_TTL_HOURS ?? 24);
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
    await this.tokens.create(user.id, hashToken(rawToken), expiresAt);

    const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const confirmationUrl = `${baseUrl}/confirm?token=${rawToken}`;

    const delivery = await this.notifier.notify({
      userId: user.id,
      email: user.email,
      confirmationUrl,
      rawToken,
    });

    this.logger.log(`registered userId=${user.id} outcome=created`);
    return {
      userId: user.id,
      email: user.email,
      confirmationUrl: delivery.confirmationUrl,
    };
  }

  async confirmEmail(rawToken: string): Promise<ConfirmResult> {
    const tokenHash = hashToken(rawToken);
    const token = await this.tokens.findByHash(tokenHash);

    if (!token) {
      this.logger.log('confirm outcome=invalid-token');
      throw new NotFoundException('invalid or unknown confirmation link');
    }

    if (token.consumed_at) {
      this.logger.log(`confirm outcome=already-used userId=${token.user_id}`);
      throw new GoneException('this confirmation link has already been used');
    }

    const now = this.clock();
    if (token.expires_at < now) {
      this.logger.log(`confirm outcome=expired userId=${token.user_id}`);
      throw new GoneException(
        'this confirmation link has expired — request a new one',
      );
    }

    await this.tokens.consume(token.id);
    const user = await this.users.markConfirmed(token.user_id);

    this.logger.log(`confirm outcome=confirmed userId=${token.user_id}`);
    return {status: 'confirmed', userId: token.user_id, email: user.email};
  }

  async resendConfirmation(email: string): Promise<ResendResult> {
    const normalisedEmail = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalisedEmail);

    if (!user) {
      // Return success to prevent email enumeration — the notifier is a no-op.
      this.logger.log('resend outcome=email-not-found');
      return {status: 'sent', email: normalisedEmail};
    }

    if (user.confirmed_at) {
      // Already confirmed — still return success to avoid enumeration.
      this.logger.log(`resend outcome=already-confirmed userId=${user.id}`);
      return {status: 'sent', email: normalisedEmail};
    }

    // Delete any prior outstanding tokens so old links return "invalid".
    await this.tokens.deleteAllForUser(user.id);

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

    this.logger.log(`resend outcome=sent userId=${user.id}`);
    return {status: 'sent', email: normalisedEmail};
  }
}
