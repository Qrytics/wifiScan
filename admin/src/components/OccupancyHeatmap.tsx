/**
 * OccupancyHeatmap — day-of-week × hour grid
 *
 * Renders a 7 × 24 colour-coded grid where cell intensity represents
 * average occupancy count.  Data comes from GET /analytics.
 */

import { type HeatmapCell } from "../api";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  cells: HeatmapCell[];
  maxCount: number;
}

function cellColour(avg: number, max: number): string {
  if (max === 0) return "bg-slate-800";
  const ratio = avg / max;
  if (ratio === 0) return "bg-slate-800";
  if (ratio < 0.25) return "bg-indigo-950";
  if (ratio < 0.5) return "bg-indigo-800";
  if (ratio < 0.75) return "bg-indigo-600";
  return "bg-indigo-400";
}

export default function OccupancyHeatmap({ cells, maxCount }: Props) {
  // Build a lookup (day, hour) → avg_count
  const lookup = new Map<string, number>();
  for (const c of cells) {
    lookup.set(`${c.day}-${c.hour}`, c.avg_count);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour axis labels */}
        <div className="flex ml-10 mb-1">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex-1 text-center text-[10px] text-slate-500"
            >
              {h % 3 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center mb-0.5">
            <span className="w-10 text-xs text-slate-400 shrink-0">{day}</span>
            {HOURS.map((h) => {
              const avg = lookup.get(`${di}-${h}`) ?? 0;
              return (
                <div
                  key={h}
                  title={`${day} ${h}:00 — avg ${avg.toFixed(1)} people`}
                  className={`flex-1 h-5 rounded-sm mx-px ${cellColour(avg, maxCount)}`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 ml-10">
          <span className="text-xs text-slate-500">Low</span>
          {["bg-slate-800", "bg-indigo-950", "bg-indigo-800", "bg-indigo-600", "bg-indigo-400"].map(
            (cls) => (
              <div key={cls} className={`w-5 h-3 rounded-sm ${cls}`} />
            )
          )}
          <span className="text-xs text-slate-500">High</span>
        </div>
      </div>
    </div>
  );
}
