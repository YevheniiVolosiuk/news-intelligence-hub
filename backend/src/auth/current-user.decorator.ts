import {createParamDecorator, ExecutionContext} from '@nestjs/common';
import {AuthenticatedUser} from './session.service';

/** Extract the authenticated user principal from the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
