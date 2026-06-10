import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {FEED_VALIDATOR, FeedValidator} from './feed-validator';
import {
  FeedAlreadyExistsError,
  FeedRow,
  FeedsRepository,
} from './feeds.repository';

export interface Feed {
  id: string;
  url: string;
  title: string | null;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalises a URL for the per-User uniqueness rule: lowercased host and no
 * trailing slash, so `https://Example.com/feed/` and `https://example.com/feed`
 * collide for the same User. Parsing failures fall back to a trimmed string so
 * the validator remains the single authority on well-formedness.
 */
function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hostname = parsed.hostname.toLowerCase();
    let out = parsed.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return url.trim().toLowerCase();
  }
}

function toFeed(row: FeedRow): Feed {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class FeedsService {
  private readonly logger = new Logger(FeedsService.name);

  constructor(
    private readonly feeds: FeedsRepository,
    @Inject(FEED_VALIDATOR) private readonly validator: FeedValidator,
  ) {}

  async addFeed(userId: string, url: string): Promise<Feed> {
    const result = await this.validator.validate(url);
    if (!result.ok) {
      this.logger.log(
        `add-feed outcome=rejected reason=${result.reason} userId=${userId}`,
      );
      throw new BadRequestException({reason: result.reason});
    }

    try {
      const row = await this.feeds.create(
        userId,
        url,
        normaliseUrl(url),
        result.title ?? null,
      );
      this.logger.log(
        `add-feed outcome=created feedId=${row.id} userId=${userId}`,
      );
      return toFeed(row);
    } catch (err) {
      if (err instanceof FeedAlreadyExistsError) {
        this.logger.log(`add-feed outcome=duplicate userId=${userId}`);
        throw new ConflictException({reason: 'duplicate'});
      }
      throw err;
    }
  }

  async listFeeds(userId: string): Promise<Feed[]> {
    const rows = await this.feeds.listForUser(userId);
    return rows.map(toFeed);
  }

  /** Moves the caller's Feed to `paused`. Idempotent; 404 if not the caller's. */
  async pauseFeed(userId: string, feedId: string): Promise<Feed> {
    return this.setStatus(userId, feedId, 'paused');
  }

  /** Moves the caller's Feed to `active`. Idempotent; 404 if not the caller's. */
  async resumeFeed(userId: string, feedId: string): Promise<Feed> {
    return this.setStatus(userId, feedId, 'active');
  }

  private async setStatus(
    userId: string,
    feedId: string,
    status: 'active' | 'paused',
  ): Promise<Feed> {
    const row = await this.feeds.setStatus(userId, feedId, status);
    if (!row) {
      throw new NotFoundException();
    }
    this.logger.log(
      `set-status outcome=updated feedId=${feedId} status=${status} userId=${userId}`,
    );
    return toFeed(row);
  }
}
