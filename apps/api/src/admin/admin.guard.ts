import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (req.user?.role !== 'admin') throw new ForbiddenException();
    return true;
  }
}
