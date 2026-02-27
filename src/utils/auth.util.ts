// src/utils/auth.util.ts

import bcrypt from 'bcrypt'
import jwt, { SignOptions } from 'jsonwebtoken'

/**
 * =========================
 * PASSWORD FUNCTIONS
 * =========================
 */

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  console.log("verify passworf")
  return bcrypt.compare(password, hashedPassword)
}

/**
 * =========================
 * TOKEN FUNCTIONS (JWT)
 * =========================
 */

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret'
const JWT_EXPIRES_IN = '7d'

export interface TokenPayload {
  id: string
  username: string
}

export function generateToken(
  payload: TokenPayload,
  options?: SignOptions
): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    ...options,
  })
}

export function verifyToken<T>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T
}