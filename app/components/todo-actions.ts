"use server";

import { getSql } from "../db";
import { readOrganization, type TodoItem } from "../(main)/organization/queries";

export async function addTodo(text: string): Promise<{ item: TodoItem | null; error: string | null }> {
  const organization = await readOrganization();
  if (!organization) return { item: null, error: "Name the organization first." };
  const body = text.trim().replace(/\s+/g, " ");
  if (!body || body.length > 160) return { item: null, error: "Enter a shorter item." };
  const sql = getSql();
  const rows = await sql`
    insert into todos (organization_id, body)
    values (${organization.id}, ${body})
    returning id, body, done
  `;
  const row = rows[0];
  if (!row) return { item: null, error: "That item was not saved." };
  return { item: { id: String(row.id), text: String(row.body), done: row.done === true }, error: null };
}

export async function toggleTodo(id: string, done: boolean): Promise<{ error: string | null }> {
  const organization = await readOrganization();
  if (!organization || !isId(id)) return { error: "That item is missing." };
  const sql = getSql();
  const rows = await sql`
    update todos
    set done = ${done}
    where id = ${id} and organization_id = ${organization.id}
    returning id
  `;
  return rows[0] ? { error: null } : { error: "That item is missing." };
}

export async function renameTodo(id: string, text: string): Promise<{ text: string | null; error: string | null }> {
  const organization = await readOrganization();
  if (!organization || !isId(id)) return { text: null, error: "That item is missing." };
  const body = text.trim().replace(/\s+/g, " ");
  if (!body || body.length > 160) return { text: null, error: "Enter a shorter item." };
  const sql = getSql();
  const rows = await sql`
    update todos
    set body = ${body}
    where id = ${id} and organization_id = ${organization.id}
    returning body
  `;
  const row = rows[0];
  return row ? { text: String(row.body), error: null } : { text: null, error: "That item is missing." };
}

export async function removeTodo(id: string): Promise<{ error: string | null }> {
  const organization = await readOrganization();
  if (!organization || !isId(id)) return { error: "That item is missing." };
  const sql = getSql();
  const rows = await sql`
    delete from todos
    where id = ${id} and organization_id = ${organization.id}
    returning id
  `;
  return rows[0] ? { error: null } : { error: "That item is missing." };
}

function isId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
