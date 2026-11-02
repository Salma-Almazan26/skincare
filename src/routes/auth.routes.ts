import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { AuthService } from '../services/auth.service';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin) {
      res.status(401).json({ success: false, error: 'Credenciales inválidas' });
      return;
    }

    const isValid = await AuthService.comparePassword(password, admin.password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Credenciales inválidas' });
      return;
    }

    const token = AuthService.generateToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    // Enviar cookie HttpOnly
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    });

    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
        token,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error?.message || 'Error al iniciar sesión',
    });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ success: true, data: req.user });
});

