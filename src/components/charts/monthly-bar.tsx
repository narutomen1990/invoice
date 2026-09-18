import { THAI_MONTHS_SHORT } from "@/lib/thai/date";

type Row = { ym: string; count: number; total: number };

const CHART_HEIGHT = 208; // px — plot area only, labels sit below it

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${n}`;
}

export function MonthlyBarChart({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-zinc-400">
        ยังไม่มีข้อมูลยอดขาย
      </div>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.total));
  // gridlines at 0 / 1/3 / 2/3 / max, rounded to a readable step
  const gridSteps = [0, max / 3, (max * 2) / 3, max];
  const lastYm = rows[rows.length - 1]!.ym;

  return (
    <div>
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        {/* recessive gridlines, back to front */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {gridSteps
            .slice()
            .reverse()
            .map((g, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-zinc-400">
                  {i === gridSteps.length - 1 ? "" : fmtCompact(g)}
                </span>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>
            ))}
        </div>

        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-1.5 pl-10">
          {rows.map((r) => {
            const isCurrent = r.ym === lastYm;
            const h = Math.max(3, (r.total / max) * CHART_HEIGHT);
            return (
              <div key={r.ym} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="text-[10px] tabular-nums text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
                  {fmtCompact(r.total)}
                </div>
                <div
                  className={`w-full rounded-t transition-colors ${
                    isCurrent ? "bg-blue-600" : "bg-blue-400/70 group-hover:bg-blue-500"
                  }`}
                  style={{ height: h }}
                  title={`${r.ym}: ฿${r.total.toLocaleString()} (${r.count} ใบ)`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* month labels */}
      <div className="mt-1.5 flex gap-1.5 pl-10">
        {rows.map((r) => {
          const [y, m] = r.ym.split("-");
          const isCurrent = r.ym === lastYm;
          return (
            <div
              key={r.ym}
              className={`flex-1 text-center text-[10px] leading-tight ${
                isCurrent ? "font-semibold text-blue-700" : "text-zinc-500"
              }`}
            >
              <div>{THAI_MONTHS_SHORT[parseInt(m!, 10)]}</div>
              <div className="text-[9px] opacity-60">{y!.slice(2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
