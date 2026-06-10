import type {ReactNode} from 'react';

/**
 * Shared body wrapper for every dashboard view. Keeps the title, description
 * and content aligned in the same 12-column content area the Overview uses,
 * so swapping views feels like one surface rather than separate pages.
 */
export function PageBody({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-card-foreground text-2xl font-medium tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground text-sm font-normal">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {children}
    </div>
  );
}

/**
 * Marks a block of UI as placeholder/example content that is wired to mock
 * data. Used to keep the original dashboard-shell widgets visible beneath the
 * real features until we delete them.
 */
export function ExampleSection({
  title = 'Examples',
  description = 'Placeholder widgets wired to mock data — kept here as reference until the real features replace them.',
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="border-border text-muted-foreground rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
          Mock data
        </span>
        <div className="border-border h-px flex-1 border-t border-dashed" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-card-foreground text-lg font-medium">{title}</h2>
        <p className="text-muted-foreground text-xs font-normal">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
