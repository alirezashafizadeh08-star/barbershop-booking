import { randomInt } from 'node:crypto';

/**
 * Generates an 8-character uppercase alphanumeric tracking code
 * without ambiguous characters (excludes 0, O, 1, I).
 * Format example: "B8K3MN9P"
 */
export function generateTrackingCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'B';
  for (let i = 0; i < 7; i++) {
    code += chars[randomInt(0, chars.length)];
  }
  return code;
}
