import { Controller, Body, Post, Request, UseGuards} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Throttle } from '@nestjs/throttler';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Throttle({default:{limit:5, ttl:60000 }})
  @Post('register')
  async register(@Body() createUserDto:CreateUserDto){
    const user = await this.usersService.create(createUserDto);
    return this.authService.login(user)
  }

  @Throttle({default:{limit:5, ttl:60000 }})
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req){
    return this.authService.login(req.user);
  }

  @Throttle({default:{limit:5, ttl:60000 }})
  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string){
    return this.authService.refresh(refreshToken)
  }

  @Post('logout')
  logout(@Body('refresh_token') refreshToken:string){
    return this.authService.logout(refreshToken);
  }



}
