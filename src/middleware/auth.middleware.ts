import { Request, Response, NextFunction } from 'express';
import { AuthService, AdminPayload } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  user?: AdminPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check HttpOnly cookie first, then Bearer Authorization header
  let token = req.cookies?.token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Acceso no autorizado. Se requiere iniciar sesión.',
    });
    return;
  }

  const payload = AuthService.verifyToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Sesión expirada o token inválido.',
    });
    return;
  }

  req.user = payload;
  next();
}

