import { passkeySignIn } from "../../passkey";

export async function POST(request: Request) {
  return passkeySignIn(request);
}
