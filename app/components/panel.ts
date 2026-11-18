"use client";

export type SideFeature = "help" | "tasks" | "message" | "notifications";

export type MessageSeat = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

type PanelState = {
  feature: SideFeature | null;
  groupId: string | null;
  group: string | null;
  recipients: MessageSeat[];
  support: boolean;
};

const closed: PanelState = { feature: null, groupId: null, group: null, recipients: [], support: false };
let state: PanelState = closed;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePanel(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readPanel() {
  return state;
}

export function readPanelServer() {
  return closed;
}

export function chooseFeature(next: SideFeature) {
  const closing = state.feature === next;
  state = {
    ...state,
    feature: closing ? null : next,
    support: next === "message" ? false : state.support,
  };
  emit();
}

export function openMessage(groupId: string, group: string, recipients: MessageSeat[]) {
  if (state.feature === "message" && state.groupId === groupId && !state.support) {
    state = { ...state, feature: null };
    emit();
    return;
  }
  state = { feature: "message", groupId, group, recipients, support: false };
  emit();
}

export function openSupport() {
  if (state.feature === "message" && state.support) {
    state = { ...state, feature: null, support: false };
    emit();
    return;
  }
  state = { feature: "message", groupId: "support", group: null, recipients: [], support: true };
  emit();
}
