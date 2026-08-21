import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';


@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
    ){}

    async validateUser(email:string, password:string){
        const user = await this.usersService.findByEmailWithPassword(email);
        if(!user ) return null;
    
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if(!passwordMatches) return null;

        const {passwordHash: _omit, ...safeUser}=user;
        return safeUser;
    };

    private hashToken(token:string){
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    async login(user: {id: string, email: string, isAdmin:boolean, isVendor:boolean}){
        const accessToken = this.jwtService.sign(
            {sub: user.id, email: user.email, isAdmin:user.isAdmin, isVendor:user.isVendor },
            {secret: this.configService.get<string>('JWT_SECRET'), expiresIn: '15m'},
        );

        const refreshToken = this.jwtService.sign(
            { sub: user.id },
            { secret: this.configService.get<string>('JWT_REFRESH_SECRET'), expiresIn: '7d'}
        );

        await this.prisma.refreshToken.create({
            data: {
                tokenHash: this.hashToken(refreshToken),
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        return {access_token: accessToken, refresh_token: refreshToken};
    } 

    async refresh(refreshToken:string){
        if(!refreshToken) throw new UnauthorizedException('Refresh token required');

        let payload: {sub: string};
        try{
            payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET')
            });
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const tokenHash = this.hashToken(refreshToken);
        const stored = await this.prisma.refreshToken.findUnique({ where: {tokenHash}});

        if(!stored || stored.expiresAt < new Date()){
            await this.prisma.refreshToken.deleteMany({where: {userId: payload.sub}});
            throw new UnauthorizedException('Refresh token reuse detected, please log in again');
        }

        await this.prisma.refreshToken.delete({where: {id:stored.id}});

        const user = await this.usersService.findOne(payload.sub);
        return this.login(user);
    }

    async logout(refreshToken: string){
        if(!refreshToken) throw new UnauthorizedException('Refresh token required');
        await this.prisma.refreshToken.deleteMany({
            where: { tokenHash: this.hashToken(refreshToken)}
        });
        return { success: true };
    }
}   

