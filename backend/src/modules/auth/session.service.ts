import {Injectable, Logger} from '@nestjs/common';
import * as jose from 'jose';
import {AuthenticatedUser} from '../../common/decorators/current-user.decorator';

export interface CookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
}

export interface SessionCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly secret: Uint8Array;
  private readonly sessionCookieName: string;
  private readonly sessionCookieSecure: boolean;

  constructor() {
    const raw = process.env.JWT_SECRET ?? 'change_me_in_env';
    this.secret = new TextEncoder().encode(raw);
    this.sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'nih_session';
    this.sessionCookieSecure = process.env.SESSION_COOKIE_SECURE === 'true';
  }

  async createSession(userId: string, email: string): Promise<SessionCookie> {
    const alg = 'HS256';
    const jwt = await new jose.SignJWT({userId, email})
      .setProtectedHeader({alg})
      .setIssuedAt()
      .setExpirationTime(process.env.JWT_TTL ?? '7d')
      .sign(this.secret);

    this.logger.log(`session created userId=${userId}`);
    return {
      name: this.sessionCookieName,
      value: jwt,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.sessionCookieSecure,
        path: '/',
      },
    };
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
    return this.sessionCookieName;
  }

  getClearCookieOptions(): CookieOptions & {expires: Date} {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.sessionCookieSecure,
      path: '/',
      expires: new Date(0),
    };
  }
}
