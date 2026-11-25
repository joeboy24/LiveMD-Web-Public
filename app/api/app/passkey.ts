import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { accountIsClosed } from "../../admin/access";
import { getSql } from "../../db";
import {
  listPasskeyIds,
  readPasskey,
  savePasskey,
  savePasskeyChallenge,
  savePasskeyCount,
  takePasskeyChallenge,
} from "../../auth/queries";
import { appError, appSession, openAppSession, readAppAccount, type AppSession } from "./account";

const rpID = "web-pi-beige-81.vercel.app";
const origin = `https://${rpID}`;
const rpName = "Live MD";

export async function passkeyRegisterOptions(request: Request) {
  const account = await readAppAccount(request);
  if (!account) return appError("Sign in required.", 401);
  if (await accountIsClosed(account.id)) return appError("This account is closed.", 403);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: account.email,
    userDisplayName: account.name || account.email,
    userID: new TextEncoder().encode(account.id),
    attestationType: "none",
    excludeCredentials: (await listPasskeyIds(account.id)).map((id) => ({ id })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  const challengeId = await savePasskeyChallenge(options.challenge, "register", account.id);
  return Response.json(
    {
      challengeId,
      challenge: options.challenge,
      userId: options.user.id,
      name: options.user.name,
      displayName: options.user.displayName,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function passkeyRegister(request: Request) {
  const account = await readAppAccount(request);
  if (!account) return appError("Sign in required.", 401);
  const body = await readJson(request);
  const challenge = await takePasskeyChallenge(text(body.challengeId), "register", account.id);
  if (!challenge) return appError("That passkey request expired. Try again.", 400);
  const response = registrationResponse(body);
  if (!response) return appError("The passkey was not complete.", 400);
  let verified = false;
  let credentialId = "";
  let publicKey = "";
  let signCount = 0;
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    verified = result.verified;
    if (result.verified) {
      credentialId = result.registrationInfo.credential.id;
      publicKey = Buffer.from(result.registrationInfo.credential.publicKey).toString("base64url");
      signCount = result.registrationInfo.credential.counter;
    }
  } catch {
    verified = false;
  }
  if (!verified || !credentialId || !publicKey) return appError("That passkey was not accepted.", 400);
  const saved = await savePasskey(account.id, credentialId, publicKey, signCount);
  if (!saved) return appError("That passkey is already saved.", 409);
  return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function passkeySignInOptions() {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });
  const challengeId = await savePasskeyChallenge(options.challenge, "sign-in", null);
  return Response.json(
    { challengeId, challenge: options.challenge },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function passkeySignIn(request: Request) {
  const body = await readJson(request);
  const challenge = await takePasskeyChallenge(text(body.challengeId), "sign-in", null);
  if (!challenge) return appError("That passkey request expired. Try again.", 400);
  const response = authenticationResponse(body);
  if (!response) return appError("The passkey was not complete.", 400);
  const stored = await readPasskey(response.id);
  if (!stored) return appError("A passkey was not found for this account.", 401);
  if (await accountIsClosed(stored.accountId)) return appError("This account is closed.", 403);
  let session: AppSession | null = null;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
        counter: stored.signCount,
      },
    });
    if (!result.verified) return appError("That passkey was not accepted.", 401);
    await savePasskeyCount(stored.credentialId, result.authenticationInfo.newCounter);
    session = await sessionFor(stored.accountId);
  } catch {
    return appError("That passkey was not accepted.", 401);
  }
  if (!session) return appError("That passkey was not accepted.", 401);
  return appSession(session);
}

async function sessionFor(accountId: string): Promise<AppSession | null> {
  const sql = getSql();
  const rows = await sql`select email, name from accounts where id = ${accountId} limit 1`;
  const row = rows[0];
  if (!row) return null;
  return openAppSession(accountId, String(row.email), row.name ? String(row.name) : null);
}

function registrationResponse(body: Record<string, unknown>): RegistrationResponseJSON | null {
  const response = record(body.response);
  const id = text(body.id);
  const clientDataJSON = text(response?.clientDataJSON);
  const attestationObject = text(response?.attestationObject);
  if (!id || !clientDataJSON || !attestationObject) return null;
  return {
    id,
    rawId: text(body.rawId) || id,
    type: "public-key",
    clientExtensionResults: {},
    response: { clientDataJSON, attestationObject },
  };
}

function authenticationResponse(body: Record<string, unknown>): AuthenticationResponseJSON | null {
  const response = record(body.response);
  const id = text(body.id);
  const clientDataJSON = text(response?.clientDataJSON);
  const authenticatorData = text(response?.authenticatorData);
  const signature = text(response?.signature);
  if (!id || !clientDataJSON || !authenticatorData || !signature) return null;
  const userHandle = text(response?.userHandle);
  return {
    id,
    rawId: text(body.rawId) || id,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON,
      authenticatorData,
      signature,
      ...(userHandle ? { userHandle } : {}),
    },
  };
}

async function readJson(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function record(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
