"use server";

import { redirect } from "next/navigation";
import { closeSession, createSignInLink, dropSignInLink } from "./queries";
import { appOrigin, mailConfigured, sendSignInLink } from "./mail";

export type SignInState = {
  error: string | null;
  sent: boolean;
};

export async function requestSignIn(_state: SignInState, formData: FormData): Promise<SignInState> {
  const email = cleanEmail(formData.get("email"));
  if (!email) return { error: "Enter an email.", sent: false };
  if (!mailConfigured()) return { error: "Mail is not connected.", sent: false };

  const token = await createSignInLink(email);
  const sent = await sendSignInLink(email, `${await appOrigin()}/sign-in/verify?token=${encodeURIComponent(token)}`);
  if (sent.error) {
    await dropSignInLink(token);
    return { error: sent.error, sent: false };
  }
  return { error: null, sent: true };
}

export async function signOut() {
  await closeSession();
  redirect("/");
}

function cleanEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}
