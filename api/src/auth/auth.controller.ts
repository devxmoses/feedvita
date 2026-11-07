import { Controller, Body, Post, Request, UseGuards} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Throttle } from '@nestjs/throttler';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'Register and receive an access + refresh token pair' })
  @ApiResponse({ status: 201, description: 'Registered, tokens returned' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 429, description: 'Too many attempts (5 per minute)' })
  @Throttle({default:{limit:5, ttl:60000 }})
  @Post('register')
  async register(@Body() createUserDto:CreateUserDto){
    const user = await this.usersService.create(createUserDto);
    return this.authService.login(user)
  }

  @ApiOperation({ summary: 'Log in and receive an access + refresh token pair' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'farmer@example.com' },
        password: { type: 'string', example: 'correcthorsebattery' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Logged in, tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many attempts (5 per minute)' })
  @Throttle({default:{limit:5, ttl:60000 }})
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req){
    return this.authService.login(req.user);
  }

  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refresh_token'],
      properties: {
        refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'New token pair returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many attempts (5 per minute)' })
  @Throttle({default:{limit:5, ttl:60000 }})
  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string){
    return this.authService.refresh(refreshToken)
  }

  @ApiOperation({ summary: 'Invalidate a refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refresh_token'],
      properties: {
        refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Refresh token invalidated' })
  @ApiResponse({ status: 429, description: 'Too many attempts (5 per minute)'})
  @Post('logout')
  logout(@Body('refresh_token') refreshToken:string){
    return this.authService.logout(refreshToken);
  }



}
