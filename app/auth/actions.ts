"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, hashPassword } from "./password";
import { accountIsClosed, accountIsSystemOnly, readAccountPages } from "../admin/access";
import { firstSystemHref } from "../admin/pages";
import { attachSeats, closeSession, createPasswordAccount, findAccountByEmail, openSession, saveAccountPhone, sessionCookie, setAccountPassword } from "./queries";

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
  if (await accountIsClosed(account.id)) return { error: "This account is closed." };
  await startSession(account.id);
  return { error: null };
}

export async function createAccount(_state: SignInState, formData: FormData): Promise<SignInState> {
  const name = cleanName(formData.get("name"));
  const phone = cleanPhone(formData.get("phone"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  if (!name) return { error: "Enter your name." };
  if (!phone) return { error: "Enter a phone number." };
  if (!email) return { error: "Enter an email." };
  if (password.length < 8) return { error: "Use at least 8 characters." };

  const existing = await findAccountByEmail(email);
  const passwordHash = await hashPassword(password);
  if (existing?.passwordHash) return { error: "That email already has an account. Sign in." };
  const accountId = existing ? existing.id : await createPasswordAccount(email, name, passwordHash, phone);
  if (existing) {
    await setAccountPassword(existing.id, existing.name ?? name, passwordHash);
    await saveAccountPhone(existing.id, phone);
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
  if (await accountIsSystemOnly(accountId)) redirect(firstSystemHref(await readAccountPages(accountId)));
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

function cleanPhone(value: FormDataEntryValue | null) {
  const phone = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!phone || phone.length > 32) return "";
  if (!/^[+()\d][+()\d.\-\s]*$/.test(phone)) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return phone;
}
