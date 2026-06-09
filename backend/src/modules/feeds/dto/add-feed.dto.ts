import {IsNotEmpty, IsString} from 'class-validator';

/**
 * Body for `POST /feeds`. Well-formedness and reachability are decided by the
 * FeedValidator seam (so the rule has one home), not duplicated here; the DTO
 * only guarantees a non-empty string arrives.
 */
export class AddFeedDto {
  @IsString()
  @IsNotEmpty({message: 'enter a feed URL'})
  url!: string;
}
