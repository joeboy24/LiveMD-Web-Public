import type { ReactNode } from "react";
import { readAccess } from "../auth/access";
import { readSessionAccount } from "../auth/queries";
import { AccountBar } from "./account-bar";

export async function CurrentAccount({
  buttonName,
  menuName,
}: {
  buttonName: ReactNode;
  menuName: ReactNode;
}) {
  const [account, access] = await Promise.all([readSessionAccount(), readAccess()]);
  return <AccountBar account={account} role={access.role} buttonName={buttonName} menuName={menuName} />;
}
