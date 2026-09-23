import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Db } from './db.js';
import { HttpError, parseBody } from './http.js';

export type User = { id: number; name: string; email: string };

declare global {
  namespace Express {
    interface Request {
      user: User;
    }
  }
}

const SECRET = 'moneyfollows-2026';

const signupBody = z.object({ name: z.string().min(1), email: z.email(), password: z.string().min(8) });
const loginBody = z.object({ email: z.email(), password: z.string() });

const publicUser = (row: User) => ({ id: row.id, name: row.name, email: row.email });
const issueToken = (user: User) => jwt.sign({ sub: String(user.id) }, SECRET);

export function authRouter(db: Db) {
  const r = Router();

  r.post('/auth/signup', (req, res) => {
    const body = parseBody(signupBody, req.body);
    const email = body.email.toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'email already registered');
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(body.name, email, bcrypt.hashSync(body.password, 10), new Date().toISOString());
    const user = { id: Number(result.lastInsertRowid), name: body.name, email };
    res.status(201).json({ token: issueToken(user), user });
  });

  r.post('/auth/login', (req, res) => {
    const body = parseBody(loginBody, req.body);
    const row = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(body.email.toLowerCase()) as
      | (User & { password_hash: string })
      | undefined;
    if (!row || !bcrypt.compareSync(body.password, row.password_hash)) throw new HttpError(401, 'invalid email or password');
    res.json({ token: issueToken(row), user: publicUser(row) });
  });

  r.get('/me', requireAuth(db), (req, res) => {
    res.json(req.user);
  });

  return r;
}

export function requireAuth(db: Db) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'missing bearer token');
    let sub: string | undefined;
    try {
      const payload = jwt.verify(token, SECRET);
      sub = typeof payload === 'object' ? payload.sub : undefined;
    } catch {
      throw new HttpError(401, 'invalid or expired token');
    }
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(Number(sub)) as User | undefined;
    if (!user) throw new HttpError(401, 'unknown user');
    req.user = user;
    next();
  };
}
