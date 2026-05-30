import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../../domain/repositories/user.repository';

const JWT_SECRET = process.env.JWT_SECRET || 'luna_hospital_secret_key_2026_secure';

export class AuthUseCase {
  constructor(private userRepository: IUserRepository) {}

  async login(username: string, password: string): Promise<{ token: string; user: any }> {
    const user = await this.userRepository.findByUsername(username.toLowerCase().trim());
    if (!user) {
      throw new Error('Authentication failed: Invalid credentials');
    }

    if (user.status !== 'Active') {
      throw new Error('Authentication failed: Account deactivated');
    }

    const isMatch = bcrypt.compareSync(password, user.password || '');
    if (!isMatch) {
      throw new Error('Authentication failed: Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Remove password before returning
    const { password: _, ...safeUser } = user;
    return { token, user: safeUser };
  }

  async logout(token: string): Promise<void> {
    try {
      const decoded: any = jwt.decode(token);
      const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 30 * 60 * 1000;
      await this.userRepository.blacklistToken(token, expiresAt);
    } catch (err) {
      await this.userRepository.blacklistToken(token, Date.now() + 30 * 60 * 1000);
    }
  }

  async verifyToken(token: string): Promise<any> {
    const isBlacklisted = await this.userRepository.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new Error('Session invalid or logged out');
    }

    return new Promise((resolve, reject) => {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return reject(new Error('Token invalid or expired'));
        resolve(decoded);
      });
    });
  }
}
