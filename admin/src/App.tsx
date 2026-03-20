/**
 * OmniPresence Admin Dashboard (Phase 6)
 *
 * Sections
 * --------
 *  1. Live Occupancy header strip
 *  2. Heatmap   — 7-day day-of-week × hour occupancy grid
 *  3. Muster Report — on-demand list of who is on the Wi-Fi
 *  4. Energy-Saving Recommendations — context-aware cards
 */

import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, Wifi } from "lucide-react";

import {
  fetchAnalytics,
  fetchStatus,
  type AnalyticsResponse,
  type StatusResponse,
} from "./api";
import OccupancyHeatmap from "./components/OccupancyHeatmap";
import MusterReport from "./components/MusterReport";
import EnergySavingCard from "./components/EnergySavingCard";

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([fetchStatus(), fetchAnalytics()]);
      setStatus(s);
      setAnalytics(a);
      setLastRefresh(new Date());
    } catch {
      // data stays stale — the UI will still show
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const maxCount = analytics
    ? Math.max(1, ...analytics.heatmap.map((c) => c.max_count))
    : 1;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top nav */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wifi className="text-indigo-400" size={22} />
          <span className="font-bold text-lg tracking-tight">
            OmniPresence{" "}
            <span className="text-slate-500 font-normal text-sm">Admin</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-xs">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-50 text-sm transition-colors"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : undefined}
            />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Live occupancy strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Currently Present"
            value={status?.total_count ?? "—"}
            icon={<Activity size={20} className="text-indigo-400" />}
            highlight
          />
          <StatCard
            label="Named Residents"
            value={
              status
                ? status.present.filter((p) => !p.is_ghost).length
                : "—"
            }
            icon={<Wifi size={20} className="text-emerald-400" />}
          />
          <StatCard
            label="Ghost Mode Active"
            value={
              status
                ? status.present.filter((p) => p.is_ghost).length
                : "—"
            }
            icon={<Wifi size={20} className="text-slate-500" />}
          />
        </div>

        {/* Heatmap */}
        <Section title="📊 Occupancy Heatmap — last 7 days">
          {analytics ? (
            <OccupancyHeatmap cells={analytics.heatmap} maxCount={maxCount} />
          ) : (
            <p className="text-slate-500 text-sm">Loading heatmap data…</p>
          )}
        </Section>

        {/* Muster Report */}
        <Section title="🚨 Muster Report">
          <MusterReport />
        </Section>

        {/* Energy Saving */}
        <Section title="💡 Energy-Saving Recommendations">
          <EnergySavingCard
            heatmapCells={analytics?.heatmap ?? []}
            currentCount={status?.total_count ?? 0}
          />
        </Section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card helper
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex items-center gap-4 ${
        highlight
          ? "border-indigo-600/50 bg-indigo-950/30"
          : "border-slate-700 bg-slate-900"
      }`}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider">
          {label}
        </p>
        <p className="text-3xl font-bold text-slate-100 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
