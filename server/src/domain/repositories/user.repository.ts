import { User } from '../entities/user.entity';

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(user: Omit<User, 'id'>): Promise<User>;
  update(id: number, user: Partial<User>): Promise<void>;
  delete(id: number): Promise<void>;
  findAll(): Promise<User[]>;
  isTokenBlacklisted(token: string): Promise<boolean>;
  blacklistToken(token: string, expiresAt: number): Promise<void>;
}
