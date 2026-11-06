import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 as sha256Hash } from '@noble/hashes/sha2.js';

// Shared by Pages Functions and the interactive bootstrap CLI. No secrets in output.
export const PASSWORD_ITERATIONS = 600_000;
export const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = (value: string) => Uint8Array.from(value.match(/../g) ?? [], b => parseInt(b, 16));
export function constantEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 16 && password.length <= 128 && new TextEncoder().encode(password).length <= 512;
}
async function derive(password: string, salt: Uint8Array, iterations: number) {
  const bytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits']);
  try {
    return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations }, key, 256)));
  } catch (error) {
    // Some hosted Workers cap native PBKDF2 even though local workerd accepts it.
    // Preserve the exact standard KDF and existing verifier; NEVER lower iterations.
    if (!(error instanceof Error) || error.name !== 'NotSupportedError') throw error;
    return hex(await pbkdf2Async(sha256Hash, bytes, salt, { c: iterations, dkLen: 32, asyncTick: 8 }));
  }
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('Kata laluan mesti 16–128 aksara.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${hex(salt)}$${await derive(password, salt, PASSWORD_ITERATIONS)}`;
}
export async function verifyPassword(password: string, stored: unknown): Promise<boolean> {
  if (!validPassword(password) || typeof stored !== 'string' || stored.length > 160) return false;
  const fields = stored.split('$');
  if (fields.length !== 4) return false;
  const [algorithm, work, salt, expected] = fields;
  if (algorithm !== 'pbkdf2-sha256' || work !== String(PASSWORD_ITERATIONS) || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{64}$/.test(expected ?? '')) return false;
  return constantEqual(await derive(password, unhex(salt), Number(work)), expected);
}
export async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
