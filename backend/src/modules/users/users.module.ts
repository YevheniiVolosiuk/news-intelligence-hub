import {Module} from '@nestjs/common';
import {UsersRepository} from './users.repository';

/**
 * Owns the Users domain data access. Exports UsersRepository so other modules
 * (e.g. AuthModule) consume it rather than re-declaring it.
 */
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
