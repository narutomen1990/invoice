import { THAI_MONTHS_SHORT } from "@/lib/thai/date";

type Row = { ym: string; count: number; total: number };

export function MonthlyBarChart({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(0)}K`
        : `${n}`;

  return (
    <div className="flex h-56 items-end gap-1.5">
      {rows.map((r) => {
        const h = (r.total / max) * 100;
        const [y, m] = r.ym.split("-");
        return (
          <div key={r.ym} className="group flex flex-1 flex-col items-center gap-1">
            <div className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100">
              {fmt(r.total)}
            </div>
            <div
              className="relative w-full rounded-t bg-blue-500/80 transition hover:bg-blue-600"
              style={{ height: `${Math.max(2, h)}%` }}
              title={`${r.ym}: ${r.total.toLocaleString()} (${r.count} ใบ)`}
            />
            <div className="mt-1 text-center text-[10px] leading-tight text-zinc-500">
              <div>{THAI_MONTHS_SHORT[parseInt(m!, 10)]}</div>
              <div className="text-[9px] opacity-60">{y!.slice(2)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
