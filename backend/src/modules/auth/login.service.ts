import {Injectable, Logger, UnauthorizedException} from '@nestjs/common';
import {PasswordHasher} from './password-hasher';
import {UsersRepository} from '../users/users.repository';
import {SessionService} from './session.service';
import {SessionCookie} from './session.service';

export interface LoginResult {
  userId: string;
  email: string;
  cookie: SessionCookie;
}

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const normalisedEmail = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalisedEmail);

    // Generic error for all failure cases — no field disclosure.
    const reject = () => {
      this.logger.log('login outcome=invalid-credentials');
      throw new UnauthorizedException('invalid email or password');
    };

    if (!user) {
      return reject();
    }

    if (!user.confirmed_at) {
      this.logger.log(`login outcome=unconfirmed userId=${user.id}`);
      return reject();
    }

    // Fetch the stored hash to verify.
    const hash = await this.users.getPasswordHash(user.id);
    const match = await this.hasher.verify(hash, password);
    if (!match) {
      return reject();
    }

    const cookie = await this.sessions.createSession(user.id, user.email);
    this.logger.log(`login outcome=ok userId=${user.id}`);
    return {userId: user.id, email: user.email, cookie};
  }
}
