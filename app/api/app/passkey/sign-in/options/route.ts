import { passkeySignInOptions } from "../../../passkey";

export async function POST() {
  return passkeySignInOptions();
}
