"use client";

import { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { addTodo, removeTodo, renameTodo, toggleTodo } from "./todo-actions";
import type { TodoItem } from "../(main)/organization/queries";

let kept: TodoItem[] | null = null;

export function TodoList({ initial }: { initial: TodoItem[] }) {
  const [items, setItems] = useState(kept ?? initial);
  kept = items;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setError(null);
    const result = await addTodo(text);
    if (!result.item) {
      setDraft(text);
      setError(result.error);
      return;
    }
    const item = result.item;
    setItems((current) => [...current, item]);
  }

  function toggle(item: TodoItem) {
    const done = !item.done;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, done } : entry)));
    void toggleTodo(item.id, done).then((result) => {
      if (!result.error) return;
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, done: item.done } : entry)));
      setError(result.error);
    });
  }

  function rename(item: TodoItem, text: string) {
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)));
    void renameTodo(item.id, text).then((result) => {
      if (result.text) return;
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
      setError(result.error);
    });
  }

  function remove(item: TodoItem) {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    void removeTodo(item.id).then((result) => {
      if (!result.error) return;
      setItems((current) => [...current, item]);
      setError(result.error);
    });
  }

  return (
    <section>
      <ul className="mt-2">
        {items.map((item) => (
          <TodoLine key={item.id} item={item} onToggle={() => toggle(item)} onRename={(text) => rename(item, text)} onRemove={() => remove(item)} />
        ))}
      </ul>
      <form
        className="flex items-center gap-2 border-t border-white/10 px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <span className="grid size-4 shrink-0 place-items-center text-muted">
          <FiPlus aria-hidden className="size-3" />
        </span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a line"
          data-help="Add something to do for this organization."
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        />
      </form>
      {error ? <p className="px-3 pb-3 text-[12px] text-[#e4372d]">{error}</p> : null}
    </section>
  );
}

function TodoLine({
  item,
  onToggle,
  onRename,
  onRemove,
}: {
  item: TodoItem;
  onToggle: () => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.text);

  function commit() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === item.text) {
      setValue(item.text);
      return;
    }
    onRename(next);
  }

  return (
    <li className="flex items-center gap-2 border-t border-white/10 px-3 py-2 first:border-t-0">
      <button
        type="button"
        aria-pressed={item.done}
        aria-label={item.done ? "Mark not done" : "Mark done"}
        data-help={item.done ? "Mark this line as still to do." : "Mark this line done."}
        onClick={onToggle}
        className={`grid size-4 shrink-0 place-items-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${item.done ? "border-primary bg-primary text-white" : "border-muted bg-transparent"}`}
      >
        {item.done ? <span className="text-[9px] leading-none">✓</span> : null}
      </button>
      {editing ? (
        <input
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setValue(item.text);
              setEditing(false);
            }
          }}
          className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
        />
      ) : (
        <button
          type="button"
          data-help="Edit this line."
          onClick={() => {
            setValue(item.text);
            setEditing(true);
          }}
          className={`min-w-0 flex-1 truncate text-left text-[13px] leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${item.done ? "text-muted line-through" : "text-ink"}`}
        >
          {item.text}
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${item.text}`}
        data-help="Delete this line."
        onClick={onRemove}
        className="grid size-5 shrink-0 place-items-center rounded-md text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        <FiX aria-hidden className="size-3" />
      </button>
    </li>
  );
}
