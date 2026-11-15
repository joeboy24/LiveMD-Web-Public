let tail: Promise<void> = Promise.resolve();

export function enqueueSave(work: () => Promise<unknown>) {
  const run = tail.then(work, work);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function flushSaves() {
  return tail;
}
