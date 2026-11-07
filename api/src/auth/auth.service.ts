import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// A real bcrypt hash at the same cost factor as the ones we store. Comparing
// against it for an unknown email keeps the response time of "no such user" and
// "wrong password" indistinguishable. The plaintext behind it is irrelevant.
const DUMMY_PASSWORD_HASH =
    '$2b$10$3l1OY/2qsyTuz65eSw5rAuUd3BA8Z2UsVXCBqNSN53eGXcsnRBeki';

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
    
        const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if(!user || !passwordMatches) return null;

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
        //if the jwt verified token is not stored in databse, the token was stolen 
        // so delete all the other sessions belonging to this user, logging them out from everywhere

        if(!stored){
            await this.prisma.refreshToken.deleteMany({where: {userId: payload.sub}});
            throw new UnauthorizedException('Refresh token reuse detected, please log in again');
        }

        //a token thats simply expired is not an attack, retire that one row and
        //let the user log in again, rather than signing them out on every device

        if(stored.expiresAt < new Date()){
            await this.prisma.refreshToken.deleteMany({where: {id: stored.id}});
            throw new UnauthorizedException('Refresh token expired, please log in again');
        }
        // deleteMany is a single conditional DELETE, so of two requests racing with
        // the same token exactly one gets count 1. The loser treats it as reuse.
        // (plain delete() would raise P2025, which the global filter turns into a
        // misleading 404.)
        const consumed = await this.prisma.refreshToken.deleteMany({where: {id:stored.id}});
        if(consumed.count === 0){
            await this.prisma.refreshToken.deleteMany({where: {userId: payload.sub}});
            throw new UnauthorizedException('Refresh token reuse detected, please log in again');
        }

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

