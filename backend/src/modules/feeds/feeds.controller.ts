import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {AddFeedDto} from './dto/add-feed.dto';
import {Feed, FeedsService} from './feeds.service';

/**
 * HTTP boundary for Feeds. Every route is tenant-scoped: the caller id comes
 * from `@CurrentUser()` and is the only User whose Feeds a request can touch.
 * No `@Public()` here, so the global JwtAuthGuard requires a session on all
 * routes (unauthenticated -> 401).
 */
@Controller('feeds')
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Post()
  @HttpCode(201)
  add(
    @Body() dto: AddFeedDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Feed> {
    return this.feeds.addFeed(user.userId, dto.url);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Feed[]> {
    return this.feeds.listFeeds(user.userId);
  }

  @Post(':id/pause')
  @HttpCode(200)
  pause(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Feed> {
    return this.feeds.pauseFeed(user.userId, id);
  }

  @Post(':id/resume')
  @HttpCode(200)
  resume(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Feed> {
    return this.feeds.resumeFeed(user.userId, id);
  }
}
