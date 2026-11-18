import nodemailer from "nodemailer";
import { headers } from "next/headers";
import { invitationLetter, signInLetter } from "./letter";

export function mailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function sender(user: string) {
  const from = process.env.MAIL_FROM?.trim();
  if (!from) return user;
  if (from.includes("@")) return from;
  return `"${from.replaceAll('"', "")}" <${user}>`;
}

const publicSite = "https://web-pi-beige-81.vercel.app";

export async function appOrigin() {
  const configured = originFrom(process.env.APP_ORIGIN) || originFrom(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (configured) return configured;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  if (host && !localHost(host)) return `${proto}://${host}`;
  return publicSite;
}

function originFrom(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return "";
  }
}

function localHost(host: string) {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return name === "localhost" || name === "127.0.0.1" || name === "::1";
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return { error: "Mail is not connected." };
  const port = Number(process.env.SMTP_PORT || 587);
  const from = sender(user);
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transport.sendMail({ from, to, subject, text, html });
    return { error: null };
  } catch {
    return { error: "The email could not be sent." };
  }
}

export async function sendInvitation(email: string, orgName: string, role: string, url: string) {
  const letter = invitationLetter(orgName, role, url);
  return sendMail(email, letter.subject, letter.text, letter.html);
}

export async function sendSignInLink(email: string, url: string) {
  const letter = signInLetter(url);
  return sendMail(email, letter.subject, letter.text, letter.html);
}
