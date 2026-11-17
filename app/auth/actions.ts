"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, hashPassword } from "./password";
import { attachSeats, closeSession, createPasswordAccount, findAccountByEmail, openSession, sessionCookie, setAccountPassword } from "./queries";

export type SignInState = {
  error: string | null;
};

export async function signInWithPassword(_state: SignInState, formData: FormData): Promise<SignInState> {
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  if (!email) return { error: "Enter an email." };
  if (!password) return { error: "Enter a password." };

  const account = await findAccountByEmail(email);
  if (!account?.passwordHash) return { error: "That email or password is wrong." };
  const matches = await checkPassword(password, account.passwordHash);
  if (!matches) return { error: "That email or password is wrong." };
  await startSession(account.id);
  return { error: null };
}

export async function createAccount(_state: SignInState, formData: FormData): Promise<SignInState> {
  const name = cleanName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  if (!name) return { error: "Enter your name." };
  if (!email) return { error: "Enter an email." };
  if (password.length < 8) return { error: "Use at least 8 characters." };

  const existing = await findAccountByEmail(email);
  const passwordHash = await hashPassword(password);
  if (existing?.passwordHash) return { error: "That email already has an account. Sign in." };
  const accountId = existing ? existing.id : await createPasswordAccount(email, name, passwordHash);
  if (existing) {
    await setAccountPassword(existing.id, existing.name ?? name, passwordHash);
    await attachSeats(email, existing.id);
  }
  await startSession(accountId);
  return { error: null };
}

export async function signOut() {
  await closeSession();
  redirect("/sign-in");
}

async function startSession(accountId: string) {
  const token = await openSession(accountId);
  const jar = await cookies();
  jar.set(sessionCookie.name, token, sessionCookie.options);
  redirect("/");
}

function cleanName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return "";
  return name;
}

function cleanEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function cleanPassword(value: FormDataEntryValue | null) {
  return String(value ?? "").slice(0, 128);
}
