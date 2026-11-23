"use client";

import { useActionState, useEffect, useState } from "react";
import { FiChevronDown, FiX } from "react-icons/fi";
import { systemPages, type SystemPage } from "../../admin/pages";
import { Field } from "../../components/field";
import { SaveButton } from "../../components/save-button";
import { Toast } from "../../components/toast";
import { Monogram } from "../organization/chrome";
import { createSystemUser, removeSystemUser, updateSystemUser, type SystemUserState } from "./actions";

const initial: SystemUserState = { error: null, saved: false, stamp: "" };

type SystemRole = "admin" | "user";

type SystemUser = {
  id: string;
  name: string;
  email: string;
  seated: boolean;
  deleted: boolean;
  role: SystemRole;
  pages: SystemPage[];
};

export function UserForm({ users, currentId, viewerIsAdmin }: { users: SystemUser[]; currentId: string; viewerIsAdmin: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SystemRole>("user");
  const [pages, setPages] = useState<SystemPage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info"; stamp: number } | null>(null);
  const [state, action, pending] = useActionState(createSystemUser, initial);
  const chosen = viewerIsAdmin ? role : "user";
  const ready = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8 && (chosen === "admin" || pages.length > 0);

  useEffect(() => {
    if (!state.saved) return;
    setName("");
    setEmail("");
    setPassword("");
    setPages([]);
    setRole("user");
    setToast({ message: "Saved.", tone: "success", stamp: Date.now() });
  }, [state.saved, state.stamp]);

  function toggle(key: SystemPage) {
    setPages((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  return (
    <div className="grid gap-8">
      <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-surface-elevated">
        <span className="block h-1 bg-primary" />
        <form action={action} className="grid gap-6 p-5 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink">New account</h2>
            <input type="hidden" name="role" value={chosen} />
            {viewerIsAdmin ? (
              <div className="grid grid-cols-2">
                {(["admin", "user"] as const).map((item) => (
                  <label key={item} className={`cursor-pointer px-3 py-3 text-center text-[14px] font-semibold outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-hover ${chosen === item ? "bg-primary text-white" : "bg-background text-muted"}`}>
                    <input type="radio" name="role-choice" value={item} checked={chosen === item} onChange={() => setRole(item)} className="sr-only" />
                    {item === "admin" ? "Admin" : "User"}
                  </label>
                ))}
              </div>
            ) : null}
            <Field label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
            <Field label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
            <Field label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          </div>
          <div>
            {chosen === "user" ? <PageChecks selected={pages} named onToggle={toggle} /> : <AdminAccess />}
            <p className="mt-3 text-[13px] leading-5 text-muted">Profile, appearance, and sign out stay open. Shows and the organization stay closed unless this account also holds a seat.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
            {state.error ? <p className="text-sm text-[#e4372d]">{state.error}</p> : <span />}
            <SaveButton pending={pending} disabled={pending || !ready} />
          </div>
        </form>
      </section>
      <Roster
        title="Admins"
        people={users.filter((user) => user.role === "admin")}
        openId={openId}
        currentId={currentId}
        viewerIsAdmin={viewerIsAdmin}
        onOpen={(id) => setOpenId((current) => (current === id ? null : id))}
        onNotice={setToast}
      />
      <Roster
        title="Users"
        people={users.filter((user) => user.role === "user")}
        openId={openId}
        currentId={currentId}
        viewerIsAdmin={viewerIsAdmin}
        onOpen={(id) => setOpenId((current) => (current === id ? null : id))}
        onNotice={setToast}
      />
      <Toast key={toast?.stamp} message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </div>
  );
}

function Roster({
  title,
  people,
  openId,
  currentId,
  viewerIsAdmin,
  onOpen,
  onNotice,
}: {
  title: string;
  people: SystemUser[];
  openId: string | null;
  currentId: string;
  viewerIsAdmin: boolean;
  onOpen: (id: string) => void;
  onNotice: (toast: { message: string; tone: "success" | "info"; stamp: number }) => void;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
      {people.length === 0 ? <p className="text-[13px] text-muted">None yet.</p> : null}
      <ul className="grid gap-2">
        {people.map((user) => (
          <Person
            key={user.id}
            user={user}
            open={openId === user.id}
            onOpen={() => onOpen(user.id)}
            locked={user.role === "admin" || user.deleted || user.id === currentId}
            canDelete={user.id !== currentId && !user.deleted && !user.seated && (user.role === "user" || viewerIsAdmin)}
            onNotice={onNotice}
          />
        ))}
      </ul>
    </section>
  );
}

function Person({
  user,
  open,
  onOpen,
  locked,
  canDelete,
  onNotice,
}: {
  user: SystemUser;
  open: boolean;
  onOpen: () => void;
  locked: boolean;
  canDelete: boolean;
  onNotice: (toast: { message: string; tone: "success" | "info"; stamp: number }) => void;
}) {
  const [pages, setPages] = useState(user.pages);

  async function toggle(key: SystemPage) {
    const next = pages.includes(key) ? pages.filter((item) => item !== key) : [...pages, key];
    setPages(next);
    const result = await updateSystemUser(user.id, next);
    if (!result.saved) {
      setPages(pages);
      onNotice({ message: result.error ?? "That account is missing.", tone: "info", stamp: Date.now() });
      return;
    }
    onNotice({ message: "Saved.", tone: "success", stamp: Date.now() });
  }

  async function remove() {
    const result = await removeSystemUser(user.id);
    onNotice({
      message: result.saved ? "Deleted." : (result.error ?? "That account is missing."),
      tone: result.saved ? "success" : "info",
      stamp: Date.now(),
    });
  }

  return (
    <li className="overflow-hidden rounded-2xl bg-surface ring-1 ring-surface-elevated">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <Monogram name={user.name} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[15px] font-semibold ${user.deleted ? "text-muted" : "text-ink"}`}>{user.name}</span>
            <span className="block truncate text-[13px] text-muted">{user.email}</span>
          </span>
          {user.deleted ? (
            <span className="text-[12px] font-semibold text-[#e4372d]">Deleted</span>
          ) : (
            <span className="hidden truncate text-[12px] font-semibold text-muted sm:block">{user.role === "admin" ? "All pages" : pageSummary(pages)}</span>
          )}
          <FiChevronDown aria-hidden className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {canDelete ? (
          <button
            type="button"
            aria-label={`Delete ${user.name}`}
            onClick={() => void remove()}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-background hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <FiX aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="border-t border-surface-elevated px-4 pt-4 pb-4">
          {user.deleted || user.role === "admin" ? null : <PageChecks selected={pages} disabled={locked} onToggle={(key) => void toggle(key)} />}
          <p className={`${user.deleted || user.role === "admin" ? "" : "mt-3 "}text-[13px] leading-5 text-muted`}>{note(user)}</p>
        </div>
      ) : null}
    </li>
  );
}

function PageChecks({
  selected,
  disabled = false,
  named = false,
  onToggle,
}: {
  selected: readonly SystemPage[];
  disabled?: boolean;
  named?: boolean;
  onToggle: (key: SystemPage) => void;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-[11px] font-semibold tracking-[0.16em] text-muted">PAGES</legend>
      <ul className="mt-2 grid gap-2">
        {systemPages.map((page) => {
          const on = selected.includes(page.key);
          return (
            <li key={page.key}>
              <label className={`flex items-start gap-3 rounded-xl bg-background px-3 py-3 ${disabled ? "" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  name={named ? "page" : undefined}
                  value={page.key}
                  checked={on}
                  onChange={() => onToggle(page.key)}
                  className="mt-1 size-4 shrink-0 accent-[#076FBF]"
                />
                <span>
                  <span className="block text-[14px] font-semibold text-ink">{page.label}</span>
                  <span className="block text-[13px] leading-5 text-muted">{page.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function AdminAccess() {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">PAGES</p>
      <p className="mt-2 rounded-xl bg-background px-3 py-3 text-[14px] font-semibold text-ink">All pages</p>
      <p className="mt-2 text-[13px] leading-5 text-muted">An admin opens Prices, Discounts, and Users. The page checklist stays with users.</p>
    </div>
  );
}

function pageSummary(pages: readonly SystemPage[]) {
  const labels = systemPages.flatMap((page) => (pages.includes(page.key) ? [page.label] : []));
  if (labels.length === 0) return "No pages";
  return labels.join(", ");
}

function note(user: SystemUser) {
  if (user.deleted) return "Deleted. The account stays for the audit trail, with no access. Earlier visits remain on this account.";
  if (user.role === "admin" && user.seated) return "This admin holds a seat, so the public pages stay open with every system page.";
  if (user.role === "admin") return "An admin opens every system page.";
  if (user.seated) return "This account holds a seat, so the public pages stay open.";
  return "Uncheck a page to close it.";
}
