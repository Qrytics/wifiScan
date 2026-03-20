/**
 * EnergySavingCard — recommendations based on occupancy data
 *
 * Analyses OccupancyLog data passed from the parent to surface
 * actionable energy-saving tips (e.g. "Zone has been empty for 45 min").
 */

import { Lightbulb, TrendingDown } from "lucide-react";
import { type HeatmapCell } from "../api";

interface Props {
  heatmapCells: HeatmapCell[];
  currentCount: number;
}

interface Recommendation {
  id: string;
  icon: "lightbulb" | "trend";
  title: string;
  detail: string;
  severity: "info" | "warning" | "action";
}

function buildRecommendations(
  cells: HeatmapCell[],
  currentCount: number
): Recommendation[] {
  const recs: Recommendation[] = [];
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = (now.getDay() + 6) % 7; // Mon=0 … Sun=6

  // Recommendation 1 — current occupancy is 0
  if (currentCount === 0) {
    recs.push({
      id: "empty-now",
      icon: "lightbulb",
      title: "Space is currently empty",
      detail:
        "No residents detected for the last 5 minutes. Consider switching lights and HVAC to eco mode.",
      severity: "action",
    });
  }

  // Recommendation 2 — historically low occupancy in the next 2 hours
  const upcomingLow = [currentHour + 1, currentHour + 2]
    .map((h) => h % 24)
    .filter((h) => {
      const cell = cells.find((c) => c.day === currentDay && c.hour === h);
      return cell === undefined || cell.avg_count < 1;
    });

  if (upcomingLow.length > 0) {
    recs.push({
      id: "low-upcoming",
      icon: "trend",
      title: "Low occupancy forecast",
      detail: `Historically near-empty at ${upcomingLow.map((h) => `${h}:00`).join(" and ")}. Schedule deferred loads (dishwasher, EV charging) for those windows.`,
      severity: "info",
    });
  }

  // Recommendation 3 — peak hours coming up, pre-heat/cool suggestion
  const peakSoon = [currentHour + 1, currentHour + 2]
    .map((h) => h % 24)
    .filter((h) => {
      const cell = cells.find((c) => c.day === currentDay && c.hour === h);
      return cell !== undefined && cell.avg_count >= 3;
    });

  if (peakSoon.length > 0) {
    recs.push({
      id: "peak-soon",
      icon: "lightbulb",
      title: "Peak occupancy expected soon",
      detail: `High traffic usually arrives around ${peakSoon.map((h) => `${h}:00`).join(" / ")}. Pre-conditioning HVAC now uses less energy than reacting later.`,
      severity: "warning",
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "all-good",
      icon: "trend",
      title: "Energy usage looks optimal",
      detail:
        "Occupancy patterns match your current energy schedule. No immediate actions needed.",
      severity: "info",
    });
  }

  return recs;
}

const severityStyles: Record<
  Recommendation["severity"],
  { card: string; badge: string }
> = {
  action: {
    card: "border-amber-600/50 bg-amber-950/30",
    badge: "bg-amber-500/20 text-amber-300",
  },
  warning: {
    card: "border-blue-600/50 bg-blue-950/30",
    badge: "bg-blue-500/20 text-blue-300",
  },
  info: {
    card: "border-slate-600/50 bg-slate-800/40",
    badge: "bg-slate-600/40 text-slate-400",
  },
};

export default function EnergySavingCard({ heatmapCells, currentCount }: Props) {
  const recommendations = buildRecommendations(heatmapCells, currentCount);

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => {
        const styles = severityStyles[rec.severity];
        return (
          <div
            key={rec.id}
            className={`rounded-xl border p-4 flex gap-3 ${styles.card}`}
          >
            <div className="mt-0.5 shrink-0">
              {rec.icon === "lightbulb" ? (
                <Lightbulb size={18} className="text-amber-400" />
              ) : (
                <TrendingDown size={18} className="text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-slate-100 font-semibold text-sm">
                  {rec.title}
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}
                >
                  {rec.severity}
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                {rec.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
