import type { ReactNode } from "react";
import { readAccess } from "../auth/access";
import { readSessionAccount } from "../auth/queries";
import { AccountBar } from "./account-bar";

export async function CurrentAccount({
  buttonName,
  menuName,
  showOrganization = true,
}: {
  buttonName: ReactNode;
  menuName: ReactNode;
  showOrganization?: boolean;
}) {
  const [account, access] = await Promise.all([readSessionAccount(), readAccess()]);
  return <AccountBar account={account} role={access.role} showOrganization={showOrganization} buttonName={buttonName} menuName={menuName} />;
}
