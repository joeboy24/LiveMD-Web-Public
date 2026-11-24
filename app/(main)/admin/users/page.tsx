import { connection } from "next/server";
import { Suspense } from "react";
import { readSystemRole, readSystemUsers } from "../../../admin/access";
import { readSessionAccount } from "../../../auth/queries";
import { PageIntro } from "../../organization/chrome";
import { UserForm } from "../user-form";

export default function SystemUsersPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading system users.</p>}>
      <Users />
    </Suspense>
  );
}

async function Users() {
  await connection();
  const [users, account, role] = await Promise.all([readSystemUsers(), readSessionAccount(), readSystemRole()]);
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="SYSTEM"
        title="Users"
        detail="An admin opens every system page. A user opens the pages you check. A user cannot delete an admin. Profile, appearance, and sign out stay available. Shows and the organization stay closed unless the account also holds a seat."
      />
      <UserForm users={users} currentId={account?.id ?? ""} viewerIsAdmin={role === "admin"} />
    </div>
  );
}
