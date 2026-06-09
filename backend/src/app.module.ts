import {Module} from '@nestjs/common';
import {AuthModule} from './modules/auth/auth.module';
import {UsersModule} from './modules/users/users.module';
import {HealthModule} from './modules/health/health.module';
import {DatabaseModule} from './infra/database.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, HealthModule],
})
export class AppModule {}
