import { passkeyRegister } from "../../passkey";

export async function POST(request: Request) {
  return passkeyRegister(request);
}
