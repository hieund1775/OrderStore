export function PageHeader({
  eyebrow,
  title,
  desc,
  bannerImg,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  bannerImg?: string;
}) {
  if (bannerImg) {
    return (
      <section className="relative border-b overflow-hidden bg-zinc-900 min-h-[220px] flex items-center">
        <img
          src={bannerImg}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="container-page relative z-10 py-12 text-center text-white md:py-16">
          {eyebrow && (
            <p className="mb-2 text-xs font-bold tracking-[0.2em] uppercase text-emerald-300 drop-shadow">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-extrabold md:text-4xl text-white drop-shadow-md">
            {title}
          </h1>
          {desc && (
            <p className="mx-auto mt-3 max-w-2xl text-sm md:text-base text-zinc-100 drop-shadow">
              {desc}
            </p>
          )}
        </div>
      </section>
    );
  }

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
