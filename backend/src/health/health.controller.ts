import {Controller, Get, ServiceUnavailableException} from '@nestjs/common';
import {Public} from '../common/decorators/public.decorator';
import {HealthReport, HealthService} from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Returns 200 with the report when every dependency is reachable, otherwise
   * 503 so container/orchestrator health checks treat the API as not ready.
   */
  @Public()
  @Get()
  async get(): Promise<HealthReport> {
    const report = await this.health.check();
    if (!report.ok) {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
