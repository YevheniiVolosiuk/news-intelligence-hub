import {Injectable} from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Wraps argon2id hashing so the algorithm and its cost parameters live in one
 * place and callers never see the raw library. Parameters are env-configurable.
 */
@Injectable()
export class PasswordHasher {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  };

  hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, this.options);
  }

  verify(hash: string, plaintext: string): Promise<boolean> {
    return argon2.verify(hash, plaintext);
  }
}
