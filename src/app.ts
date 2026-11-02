import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { catalogRouter } from './routes/catalog.routes';
import { orderRouter } from './routes/order.routes';
import { authRouter } from './routes/auth.routes';
import { adminRouter } from './routes/admin.routes';

export const app = express();

// Middlewares globales
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// Rutas API
app.use('/api/catalog', catalogRouter);
app.use('/api/orders', orderRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'K-Beauty E-commerce Engine',
  });
});

// Enrutamiento frontend amigable
app.get('/admin', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
    return;
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Manejador global de errores
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error Global]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
  });
});

export default app;

