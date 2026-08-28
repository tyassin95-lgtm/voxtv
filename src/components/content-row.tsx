export function ContentRow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-4 font-display text-lg font-semibold tracking-tight md:px-8">
        {title}
      </h2>
      <div className="row-scroll flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:gap-4 md:px-8">
        {children}
      </div>
    </section>
  );
}
