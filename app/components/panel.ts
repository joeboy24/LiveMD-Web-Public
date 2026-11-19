"use client";

export type SideFeature = "help" | "tasks" | "message" | "notifications" | "checkout";

export type CheckoutTerm = {
  term: "quarter" | "year";
  label: string;
  cents: number;
};

export type CheckoutDraft = {
  plan: string;
  terms: CheckoutTerm[];
  currency: string;
  seats: number;
  storage: number | null;
};

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
  checkout: CheckoutDraft | null;
};

const closed: PanelState = { feature: null, groupId: null, group: null, recipients: [], support: false, checkout: null };
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
    checkout: closing || next !== "checkout" ? null : state.checkout,
  };
  emit();
}

export function openCheckout(draft: CheckoutDraft) {
  const current = state.checkout;
  const same = state.feature === "checkout" && current?.plan === draft.plan && current.seats === draft.seats;
  state = same ? { ...closed } : { ...closed, feature: "checkout", checkout: draft };
  emit();
}

export function syncCheckout(draft: CheckoutDraft) {
  if (state.feature !== "checkout" || state.checkout?.plan !== draft.plan) return;
  state = { ...state, checkout: draft };
  emit();
}

export function openMessage(groupId: string, group: string, recipients: MessageSeat[]) {
  if (state.feature === "message" && state.groupId === groupId && !state.support) {
    state = { ...state, feature: null };
    emit();
    return;
  }
  state = { ...closed, feature: "message", groupId, group, recipients };
  emit();
}

export function openSupport() {
  if (state.feature === "message" && state.support) {
    state = { ...state, feature: null, support: false };
    emit();
    return;
  }
  state = { ...closed, feature: "message", groupId: "support", support: true };
  emit();
}
