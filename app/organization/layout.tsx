import type { ReactNode } from "react";
import { OrganizationNav } from "./nav";

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <OrganizationNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
