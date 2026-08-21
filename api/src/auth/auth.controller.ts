import { Controller, Body, Post, Request, UseGuards} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() createUserDto:CreateUserDto){
    const user = await this.usersService.create(createUserDto);
    return this.authService.login(user)
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req){
    return this.authService.login(req.user);
  }

  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string){
    return this.authService.refresh(refreshToken)
  }

  @Post('logout')
  logout(@Body('refresh_token') refreshToken:string){
    return this.authService.logout(refreshToken);
  }



}
