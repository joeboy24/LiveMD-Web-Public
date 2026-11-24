import { accountIsClosed } from "../../admin/access";
import { hashPassword, checkPassword } from "../../auth/password";
import {
  attachSeats,
  createOpenAccount,
  createPasswordAccount,
  findAccountByEmail,
  openSession,
  saveAccountName,
  saveAccountPhone,
  setAccountPassword,
} from "../../auth/queries";

export type AppSession = {
  token: string;
  email: string;
  name: string;
};

export function cleanName(value: unknown) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return "";
  return name;
}

export function cleanEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export function cleanPassword(value: unknown) {
  return String(value ?? "").slice(0, 128);
}

export function cleanPhone(value: unknown) {
  const phone = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!phone || phone.length > 32) return "";
  if (!/^[+()\d][+()\d.\-\s]*$/.test(phone)) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return phone;
}

export function appError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function appSession(session: AppSession) {
  return Response.json(session, { headers: { "Cache-Control": "no-store" } });
}

export async function openAppSession(accountId: string, email: string, name: string | null): Promise<AppSession> {
  const token = await openSession(accountId);
  return { token, email, name: name ?? "" };
}

export async function signInApp(email: string, password: string) {
  if (!email) return appError("Enter an email.", 400);
  if (!password) return appError("Enter a password.", 400);
  const account = await findAccountByEmail(email);
  if (!account?.passwordHash) return appError("That email or password is wrong.", 401);
  const matches = await checkPassword(password, account.passwordHash);
  if (!matches) return appError("That email or password is wrong.", 401);
  if (await accountIsClosed(account.id)) return appError("This account is closed.", 403);
  return appSession(await openAppSession(account.id, account.email, account.name));
}

export async function signUpApp(name: string, email: string, password: string, phone: string) {
  if (!name) return appError("Enter your name.", 400);
  if (!email) return appError("Enter an email.", 400);
  if (password.length < 8) return appError("Use at least 8 characters.", 400);
  const existing = await findAccountByEmail(email);
  const passwordHash = await hashPassword(password);
  if (existing?.passwordHash) return appError("That email already has an account. Sign in.", 409);
  const accountId = existing ? existing.id : await createPasswordAccount(email, name, passwordHash, phone || null);
  if (existing) {
    await setAccountPassword(existing.id, existing.name ?? name, passwordHash);
    if (phone) await saveAccountPhone(existing.id, phone);
    await attachSeats(email, existing.id);
  }
  if (await accountIsClosed(accountId)) return appError("This account is closed.", 403);
  return appSession(await openAppSession(accountId, email, existing?.name ?? name));
}

export async function signInGoogle(email: string, name: string): Promise<AppSession | null> {
  const existing = await findAccountByEmail(email);
  if (existing && (await accountIsClosed(existing.id))) return null;
  const accountId = existing ? existing.id : await createOpenAccount(email, name);
  if (existing && !existing.name && name) await saveAccountName(existing.id, name);
  return openAppSession(accountId, email, existing?.name ?? name);
}
