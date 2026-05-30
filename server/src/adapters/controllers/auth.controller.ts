import { Request, Response } from 'express';
import { AuthUseCase } from '../../usecases/auth/auth.usecase';

export class AuthController {
  constructor(private authUseCase: AuthUseCase) {}

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      const { token, user } = await this.authUseCase.login(username, password);

      // Set session cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000 // 30 minutes
      });

      res.status(200).json({ token, user });
    } catch (err: any) {
      console.error('[AUTH] Login failure:', err.message);
      res.status(401).json({ error: err.message });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const cookies = req.headers.cookie ? parseCookies(req.headers.cookie) : {};
      const token = cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
      
      if (token) {
        await this.authUseCase.logout(token);
      }

      res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (err: any) {
      console.error('[AUTH] Logout error:', err.message);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
}

// Helper to parse cookies inline
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
}
