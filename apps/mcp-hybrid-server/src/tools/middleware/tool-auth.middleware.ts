import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    permissions: string[];
    roles: string[];
  };
  toolContext?: {
    permissions: string[];
    ratelimit?: {
      remaining: number;
      reset: Date;
    };
  };
}

@Injectable()
export class ToolAuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Extract token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      // Verify JWT token
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      // Set user context
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        permissions: decoded.permissions || [],
        roles: decoded.roles || [],
      };

      // Set tool execution context
      req.toolContext = {
        permissions: decoded.permissions || [],
        ratelimit: await this.checkRateLimit(req.user.id),
      };

      // Check if user has basic tool access permission
      if (!this.hasPermission(req.user.permissions, 'tool:read')) {
        throw new ForbiddenException('Insufficient permissions for tool access');
      }

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      throw error;
    }
  }

  private hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Check for exact permission or wildcard permissions
    return userPermissions.includes(requiredPermission) ||
           userPermissions.includes('tool:*') ||
           userPermissions.includes('admin:*');
  }

  private async checkRateLimit(userId: string): Promise<{ remaining: number; reset: Date }> {
    // Implementation would depend on your rate limiting strategy
    // This could use Redis, in-memory cache, or database
    
    // For now, return a mock rate limit
    return {
      remaining: 100,
      reset: new Date(Date.now() + 3600000), // 1 hour from now
    };
  }
}

@Injectable()
export class ToolPermissionGuard {
  static requiredPermissions(...permissions: string[]) {
    return (req: AuthenticatedRequest): boolean => {
      if (!req.user) {
        return false;
      }

      return permissions.every(permission => 
        this.prototype.hasPermission(req.user!.permissions, permission)
      );
    };
  }

  private hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Support for hierarchical permissions
    const parts = requiredPermission.split(':');
    const wildcards = [];
    
    // Generate wildcard patterns (e.g., tool:manage:* from tool:manage:create)
    for (let i = 1; i <= parts.length; i++) {
      wildcards.push(parts.slice(0, i).join(':') + ':*');
    }
    
    return userPermissions.includes(requiredPermission) ||
           wildcards.some(wildcard => userPermissions.includes(wildcard)) ||
           userPermissions.includes('admin:*');
  }
}