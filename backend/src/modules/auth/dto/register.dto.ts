import {IsEmail, IsString, MinLength} from 'class-validator';

/** Minimum acceptable password length; stated here so the rule has one home. */
export const PASSWORD_MIN_LENGTH = 12;

export class RegisterDto {
  @IsEmail({}, {message: 'enter a valid email address'})
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  password!: string;
}
