import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedRequest } from '../middleware/tool-auth.middleware';

@Injectable()
export class ToolAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    
    // Check if user is authenticated (middleware should have set this)
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Check if user has basic tool access permission
    const hasToolAccess = request.user.permissions.includes('tool:read') ||
                         request.user.permissions.includes('tool:*') ||
                         request.user.permissions.includes('admin:*');

    if (!hasToolAccess) {
      throw new UnauthorizedException('Insufficient permissions for tool access');
    }

    return true;
  }
}