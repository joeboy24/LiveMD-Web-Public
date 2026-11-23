import { Suspense, type ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readSystemAdmin, readSystemPages } from "../../admin/access";
import { firstSystemHref, systemPageFor } from "../../admin/pages";
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
  const pages = await readSystemPages();
  const path = (await headers()).get("x-livemd-path") ?? "";
  const page = systemPageFor(path);
  if (!page || !pages.includes(page.key)) redirect(firstSystemHref(pages));
  return (
    <div className="mx-auto h-full min-h-0 w-full max-w-6xl overflow-y-auto">
      <AdminNav pages={pages} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
