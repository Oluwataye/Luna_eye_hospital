import { Request, Response, NextFunction } from 'express';
import { AuthUseCase } from '../../../usecases/auth/auth.usecase';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const createAuthMiddleware = (authUseCase: AuthUseCase) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const openRoutes = ['/api/login', '/api/status', '/login', '/status', '/api/logout', '/logout'];
    const path = req.path;

    if (openRoutes.includes(path)) {
      next();
      return;
    }

    const cookies = req.headers.cookie ? parseCookies(req.headers.cookie) : {};
    let token: string | undefined = cookies.token;

    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const user = await authUseCase.verifyToken(token);
      req.user = user;
      next();
    } catch (err: any) {
      console.error(`[AUTH] Decoupled Token verify error for path ${path}:`, err.message);
      res.status(401).json({ error: err.message || 'Token invalid or expired' });
    }
  };
};

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
}
