import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/environment';

export interface AdminPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: AdminPayload): string {
    return jwt.sign(payload, ENV.JWT_SECRET, {
      expiresIn: '24h',
    });
  }

  static verifyToken(token: string): AdminPayload | null {
    try {
      return jwt.verify(token, ENV.JWT_SECRET) as AdminPayload;
    } catch {
      return null;
    }
  }
}

