import {IsEmail} from 'class-validator';

export class ResendConfirmationDto {
  @IsEmail({}, {message: 'enter a valid email address'})
  email!: string;
}
