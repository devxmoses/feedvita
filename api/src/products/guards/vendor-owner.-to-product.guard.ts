import { CanActivate, ExecutionContext, Injectable, NotFoundException, ForbiddenException, BadRequestException} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class VendorOwnerToProductGuard implements CanActivate{
   constructor(private readonly prisma:PrismaService){}

    async canActivate(context:ExecutionContext):Promise<boolean>{
        
        const request = context.switchToHttp().getRequest();
        const {user, body} = request;

        if(!user) return false;
        if(user.isAdmin) return true;
        if(!body.vendorId) throw new BadRequestException('vendorId is required');

        const vendor = await this.prisma.vendor.findUnique({
            where:{id:body.vendorId},
            select:{ownerId:true}
        })

        if (!vendor) throw new NotFoundException(`Vendor with ID ${body.vendorId} not found`);
        if (vendor.ownerId === user.id) return true;

        throw new ForbiddenException('You can only create products for your own vendor');

    } 
}