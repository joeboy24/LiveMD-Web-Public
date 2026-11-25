import { passkeyRegisterOptions } from "../../../passkey";

export async function POST(request: Request) {
  return passkeyRegisterOptions(request);
}
