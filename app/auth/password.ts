import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const keyLength = 32;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scrypt(password, salt, keyLength)) as Buffer;
  return `scrypt$${salt}$${key.toString("base64url")}`;
}

export async function checkPassword(password: string, stored: string) {
  const [kind, salt, encoded] = stored.split("$");
  if (kind !== "scrypt" || !salt || !encoded) return false;
  const key = (await scrypt(password, salt, keyLength)) as Buffer;
  const expected = Buffer.from(encoded, "base64url");
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}
