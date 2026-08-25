import { PrismaService } from "../../prisma/prisma.service"
import { CanActivate, ExecutionContext,ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"

@Injectable()
export class VendorOwnerOrAdminGuard implements CanActivate{
    constructor(private readonly prisma:PrismaService){}

    async canActivate(context:ExecutionContext): Promise<boolean>{
        const request = context.switchToHttp().getRequest();
        const {user, params} = request;

        if(!user) return false;
        if(user.isAdmin) return true;
        
        const vendor = await this.prisma.vendor.findUnique({where:{id:params.id},select:{ownerId:true}});
        if(!vendor) throw new NotFoundException(`Vendor with ID ${params.id} not found`)
        if(vendor.ownerId === user.id) return true;

        throw new ForbiddenException('You can only modify your own vendor')
    }
}