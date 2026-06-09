import {Module} from '@nestjs/common';
import {HealthController} from './health.controller';
import {HealthService} from './health.service';

/** Liveness/readiness endpoint for the API and its backing services. */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
