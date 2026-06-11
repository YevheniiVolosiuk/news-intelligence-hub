import {Controller, Get} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {OperationSpend, TelemetryService} from './telemetry.service';

/**
 * HTTP boundary for Telemetry — the read path for LLM spend. Tenant-scoped: the
 * caller id comes from `@CurrentUser()` and is the only User whose spend a
 * request can see. No `@Public()`, so the global JwtAuthGuard requires a session
 * (unauthenticated -> 401). This is the seam the Phase-2 dashboard will render.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get()
  byOperation(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OperationSpend[]> {
    return this.telemetry.spendByOperation(user.userId);
  }
}
