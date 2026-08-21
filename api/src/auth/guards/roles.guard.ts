import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "../enums/role.enum";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Observable } from "rxjs";

const ROLE_FIELD: Record<Role, 'isAdmin' | 'isVendor'> = {
    [Role.Admin]: 'isAdmin',
    [Role.Vendor]: 'isVendor',
};


@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector){}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY,[
            context.getHandler(),
            context.getClass(),
        ]);

        if(!requiredRoles || requiredRoles.length === 0) return true;
        
        const { user } = context.switchToHttp().getRequest();
        if(!user) return false;

        return requiredRoles.some((role)=>user[ROLE_FIELD[role]] === true);
    }    
}
