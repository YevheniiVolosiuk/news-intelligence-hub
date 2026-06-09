// Skeleton landing page. Rendered per-request (never at build time, so the image
// build does not depend on the backend being up) and reports whether the frontend
// container can reach the backend API over the Docker network.
export const dynamic = 'force-dynamic';

interface BackendHealth {
  ok: boolean;
  service?: string;
  checks?: {db: {ok: boolean}; redis: {ok: boolean}};
  error?: string;
}

async function getBackendHealth(): Promise<BackendHealth> {
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:3000';
  try {
    const res = await fetch(`${base}/health`, {cache: 'no-store'});
    const body = (await res.json()) as BackendHealth;
    return {...body, ok: res.ok && body.ok};
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unreachable',
    };
  }
}

function Dot({ok}: {ok: boolean}) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`}
      aria-hidden
    />
  );
}

export default async function Page() {
  const health = await getBackendHealth();
  const rows: Array<{label: string; ok: boolean}> = [
    {label: 'Backend API', ok: health.ok},
    {label: 'PostgreSQL', ok: Boolean(health.checks?.db.ok)},
    {label: 'Redis', ok: Boolean(health.checks?.redis.ok)},
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          News Intelligence Hub
        </h1>
        <p className="text-sm text-slate-400">
          Skeleton stack. This page confirms the frontend can reach the backend
          and its dependencies over the Docker network.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <ul className="divide-y divide-slate-800">
          {rows.map(row => (
            <li
              key={row.label}
              className="flex items-center justify-between py-3"
            >
              <span className="text-sm text-slate-200">{row.label}</span>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <Dot ok={row.ok} />
                {row.ok ? 'healthy' : 'unreachable'}
              </span>
            </li>
          ))}
        </ul>
        {health.error ? (
          <p className="mt-3 text-xs text-rose-400">backend: {health.error}</p>
        ) : null}
      </section>
    </main>
  );
}
