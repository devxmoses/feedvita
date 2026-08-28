import { CanActivate, ExecutionContext, Injectable, NotFoundException, ForbiddenException, BadRequestException} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class VendorOwnerToOrderGuard implements CanActivate{
   constructor(private readonly prisma:PrismaService){}

    async canActivate(context:ExecutionContext):Promise<boolean>{
    
        const request = context.switchToHttp().getRequest();
        const { user, params} = request; //the params are from the order

        if(!user) return false;
        if(user.isAdmin) return true

        const vendor = await this.prisma.vendor.findUnique({
            where:{id:params.vendorId}, 
            select:{ownerId:true},
        });
        if (!vendor) throw new NotFoundException(`Vendor with ID ${params.vendorId} not found`);
        if (vendor.ownerId === user.id) return true;
        
        throw new ForbiddenException('You can only view orders for your own vendor');

    }
}