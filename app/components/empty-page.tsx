export function EmptyPage({ title, detail }: { title: string; detail: string }) {
  return (
    <section>
      <h1 className="text-[22px] font-bold text-ink">{title}</h1>
      <p className="mt-3 text-base text-muted">{detail}</p>
    </section>
  );
}
