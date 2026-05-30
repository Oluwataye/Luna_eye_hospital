import db from '../../infrastructure/database/sqlite';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository';

export class UserRepositorySqlite implements IUserRepository {
  findById(id: number): Promise<User | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row: any) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  findByUsername(username: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username], (err, row: any) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  create(user: Omit<User, 'id'>): Promise<User> {
    return new Promise((resolve, reject) => {
      const { username, password, full_name, role, department, phone_number, status } = user;
      db.run(
        'INSERT INTO users (username, password, full_name, role, department, phone_number, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
        [username, password, full_name, role, department || 'General', phone_number || null, status || 'Active'],
        function (this: any, err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            ...user
          });
        }
      );
    });
  }

  update(id: number, user: Partial<User>): Promise<void> {
    return new Promise((resolve, reject) => {
      const keys = Object.keys(user);
      if (keys.length === 0) return resolve();
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = Object.values(user);
      db.run(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  delete(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE id = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  findAll(): Promise<User[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, username, full_name, role, department, phone_number, status, created_at FROM users', [], (err, rows: User[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  isTokenBlacklisted(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      db.get('SELECT token FROM token_blacklist WHERE token = ?', [token], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    });
  }

  blacklistToken(token: string, expiresAt: number): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run('INSERT OR IGNORE INTO token_blacklist (token, expires_at) VALUES (?, ?)', [token, expiresAt], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}
