export function PageHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
}) {
  return (
    <section className="gradient-fresh border-b">
      <div className="container-page py-12 text-center md:py-16">
        {eyebrow && (
          <p className="text-primary mb-2 text-xs font-bold tracking-[0.2em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">{title}</h1>
        {desc && (
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm md:text-base">
            {desc}
          </p>
        )}
      </div>
    </section>
  );
}
