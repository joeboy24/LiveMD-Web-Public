"use server";

import { revalidatePath } from "next/cache";
import { checkPassword, hashPassword } from "../../auth/password";
import { readAccountSecret, readSessionAccount, replaceAccountPassword, saveAccountEmail, saveAccountName } from "../../auth/queries";

export type ProfileState = {
  error: string | null;
  saved: boolean;
  stamp: string;
};

const idle: ProfileState = { error: null, saved: false, stamp: "" };

export async function saveProfile(_state: ProfileState, formData: FormData): Promise<ProfileState> {
  const account = await readSessionAccount();
  if (!account) return { ...idle, error: "Sign in to take a seat." };
  const name = cleanName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  if (!name) return { ...idle, error: "Enter your name." };
  if (!email) return { ...idle, error: "Enter an email." };

  if (email !== account.email.toLowerCase()) {
    const password = cleanPassword(formData.get("password"));
    const secret = await readAccountSecret(account.id);
    if (!secret || !password || !(await checkPassword(password, secret))) return { ...idle, error: "That password is wrong." };
    const saved = await saveAccountEmail(account.id, email);
    if (!saved) return { ...idle, error: "That email already has an account." };
  }
  if (name !== (account.name ?? "")) await saveAccountName(account.id, name);
  revalidatePath("/", "layout");
  return { error: null, saved: true, stamp: String(Date.now()) };
}

export async function savePassword(_state: ProfileState, formData: FormData): Promise<ProfileState> {
  const account = await readSessionAccount();
  if (!account) return { ...idle, error: "Sign in to take a seat." };
  const current = cleanPassword(formData.get("current"));
  const next = cleanPassword(formData.get("next"));
  if (next.length < 8) return { ...idle, error: "Use at least 8 characters." };
  const secret = await readAccountSecret(account.id);
  if (!secret || !(await checkPassword(current, secret))) return { ...idle, error: "That password is wrong." };
  if (current === next) return { ...idle, error: "Choose a different password." };
  await replaceAccountPassword(account.id, await hashPassword(next));
  return { error: null, saved: true, stamp: String(Date.now()) };
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
