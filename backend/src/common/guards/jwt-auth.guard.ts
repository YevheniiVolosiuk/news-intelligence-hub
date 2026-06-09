import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {IS_PUBLIC_KEY} from '../decorators/public.decorator';
import {JwtVerifier} from '../auth/jwt-verifier';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: JwtVerifier,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[this.verifier.getCookieName()];

    if (!token) {
      throw new UnauthorizedException();
    }

    const user = await this.verifier.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }
}
