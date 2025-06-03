import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { AuthenticatedRequest } from '../middleware/tool-auth.middleware';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const RequiredPermissions = (...permissions: string[]) => 
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

@Injectable()
export class ToolPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasPermission = this.checkPermissions(user.permissions, requiredPermissions);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }

  private checkPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    return requiredPermissions.every(permission => 
      this.hasPermission(userPermissions, permission)
    );
  }

  private hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Check for exact permission
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check for wildcard permissions
    if (userPermissions.includes('admin:*')) {
      return true;
    }

    // Check for hierarchical wildcard permissions
    const parts = requiredPermission.split(':');
    for (let i = 1; i < parts.length; i++) {
      const wildcardPermission = parts.slice(0, i).join(':') + ':*';
      if (userPermissions.includes(wildcardPermission)) {
        return true;
      }
    }

    return false;
  }

  // Static method for use in decorators
  static requiredPermissions(...permissions: string[]) {
    return RequiredPermissions(...permissions);
  }
}