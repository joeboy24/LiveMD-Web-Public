import type { ReactNode } from "react";
import { readSystemAdmin } from "../admin/access";
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
  const [account, access, systemAdmin] = await Promise.all([readSessionAccount(), readAccess(), readSystemAdmin()]);
  return <AccountBar account={account} role={access.role} systemAdmin={systemAdmin} buttonName={buttonName} menuName={menuName} />;
}
