import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { readSystemAdmin } from "../../admin/access";
import { AdminNav } from "./nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="mx-auto mt-8 w-full max-w-3xl text-base text-muted">Loading system.</p>}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}

async function AdminFrame({ children }: { children: ReactNode }) {
  const admin = await readSystemAdmin();
  if (!admin) redirect("/");
  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
