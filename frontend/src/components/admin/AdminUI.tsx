import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function AdminPageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">{title}</h1>
        {desc && <p className="text-muted-foreground mt-1 text-sm">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
  tone?: 'primary' | 'leaf' | 'berry' | 'muted';
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    leaf: 'bg-leaf/10 text-leaf',
    berry: 'bg-berry/10 text-berry',
    muted: 'bg-muted text-muted-foreground',
  }[tone];

  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-start gap-4 p-5">
        {icon && (
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', toneClass)}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="font-display mt-1 text-xl font-extrabold md:text-2xl">{value}</p>
          {delta && <p className="text-muted-foreground mt-1 text-xs">{delta} so với hôm qua</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  desc,
  actions,
  children,
  className,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('shadow-soft', className)}>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-base font-bold">{title}</p>
            {desc && <p className="text-muted-foreground text-xs">{desc}</p>}
          </div>
          {actions}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
