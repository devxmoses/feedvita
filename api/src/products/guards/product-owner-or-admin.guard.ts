import { CanActivate, ExecutionContext, Injectable, NotFoundException, ForbiddenException} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ProductOwnerOrAdminGuard implements CanActivate{
   constructor(private readonly prisma:PrismaService){}

   async canActivate(context:ExecutionContext):Promise<boolean>{
        
    const request = context.switchToHttp().getRequest();
    const {user, params} = request;

    if(!user) return false;
    if(user.isAdmin) return true;

    const product = await this.prisma.product.findUnique({
        where:{id:params.id},
        select:{vendor:{select:{ownerId:true}}}
    })

    if (!product) throw new NotFoundException(`Product with ID ${params.id} not found`);
    if (product.vendor.ownerId === user.id) return true;

    throw new ForbiddenException('You can only modify products for your own vendor');

    
   } 
}