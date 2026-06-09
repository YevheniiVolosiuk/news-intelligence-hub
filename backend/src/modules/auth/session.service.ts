import {Injectable, Logger} from '@nestjs/common';
import * as jose from 'jose';
import {JwtVerifier} from '../../common/auth/jwt-verifier';

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
  private readonly sessionCookieSecure: boolean;

  constructor(private readonly verifier: JwtVerifier) {
    this.sessionCookieSecure = process.env.SESSION_COOKIE_SECURE === 'true';
  }

  async createSession(userId: string, email: string): Promise<SessionCookie> {
    const alg = 'HS256';
    const jwt = await new jose.SignJWT({userId, email})
      .setProtectedHeader({alg})
      .setIssuedAt()
      .setExpirationTime(process.env.JWT_TTL ?? '7d')
      .sign(this.verifier.getSecret());

    this.logger.log(`session created userId=${userId}`);
    return {
      name: this.verifier.getCookieName(),
      value: jwt,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.sessionCookieSecure,
        path: '/',
      },
    };
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
