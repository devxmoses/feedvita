import { CanActivate, ExecutionContext, Injectable, NotFoundException, ForbiddenException} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrderOwnerOrAdminGuard implements CanActivate{
   constructor(private readonly prisma:PrismaService){}

   async canActivate(context:ExecutionContext):Promise<boolean>{
        
    const request = context.switchToHttp().getRequest();
    const {user, params} = request;

    if(!user) return false;
    if(user.isAdmin) return true;

    const order = await this.prisma.order.findUnique({
        where:{id:params.id},
        select:{buyerId:true}
    })

    if (!order) throw new NotFoundException(`Order with ID ${params.id} not found`);
    if (order.buyerId === user.id) return true;

    throw new ForbiddenException('You can only view your own orders');

    
   } 
}