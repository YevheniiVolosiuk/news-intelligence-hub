import {Injectable} from '@nestjs/common';
import * as jose from 'jose';
import {AuthenticatedUser} from '../decorators/current-user.decorator';

/**
 * Cross-cutting JWT verification primitive used by the auth guard (common/).
 * Owns the JWT secret and cookie-name config so the guard never depends on
 * modules/. Session issuance (signing) lives in modules/auth and injects this
 * for the shared secret.
 */
@Injectable()
export class JwtVerifier {
  private readonly secret: Uint8Array;
  private readonly cookieName: string;

  constructor() {
    const raw = process.env.JWT_SECRET ?? 'change_me_in_env';
    this.secret = new TextEncoder().encode(raw);
    this.cookieName = process.env.SESSION_COOKIE_NAME ?? 'nih_session';
  }

  async verifyToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const {payload} = await jose.jwtVerify(token, this.secret);
      return {
        userId: payload.userId as string,
        email: payload.email as string,
      };
    } catch {
      return null;
    }
  }

  getCookieName(): string {
    return this.cookieName;
  }

  /** Exposed so SessionService can sign tokens with the same secret. */
  getSecret(): Uint8Array {
    return this.secret;
  }
}
