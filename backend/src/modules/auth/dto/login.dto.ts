import {IsEmail, IsString, MinLength} from 'class-validator';
import {PASSWORD_MIN_LENGTH} from './register.dto';

export class LoginDto {
  @IsEmail({}, {message: 'enter a valid email address'})
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  password!: string;
}
