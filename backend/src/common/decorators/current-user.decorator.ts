import {createParamDecorator, ExecutionContext} from '@nestjs/common';

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
}

/** Extract the authenticated user principal from the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
