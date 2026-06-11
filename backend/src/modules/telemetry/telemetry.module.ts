import {Module} from '@nestjs/common';
import {TelemetryController} from './telemetry.controller';
import {TelemetryRepository} from './telemetry.repository';
import {TelemetryService} from './telemetry.service';

/**
 * Owns the read path for Telemetry (LLM spend accounting). HTTP boundary +
 * tenant-scoped aggregate reads over the shared `llm_telemetry` ledger. The
 * write side belongs to the labelling module; this module never writes.
 */
@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryRepository],
})
export class TelemetryModule {}
