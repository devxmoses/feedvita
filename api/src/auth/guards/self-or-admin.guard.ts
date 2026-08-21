import { CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";

export class SelfOrAdminGuard implements CanActivate{
    canActivate(context:ExecutionContext): boolean{
        const request = context.switchToHttp().getRequest();
        const { user, params } = request;

        if(!user) return false;
        if(user.isAdmin) return true;
        if(user.id === params.id) return true;

        throw new ForbiddenException ('You can only modify your own account');
    }
}