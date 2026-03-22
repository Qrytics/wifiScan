/**
 * MusterReport — emergency presence list
 *
 * Lists every device currently seen on the Wi-Fi with its status badge.
 * Triggered by a button so it feels intentional (emergency context).
 */

import { useState } from "react";
import { ClipboardList, Loader2, Wifi, WifiOff } from "lucide-react";
import { fetchDevices, type DeviceRecord } from "../api";

export default function MusterReport() {
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDevices();
      setDevices(data);
    } catch (err) {
      setError("Failed to load device list.");
    } finally {
      setLoading(false);
    }
  };

  const online = devices?.filter((d) => d.online) ?? [];
  const offline = devices?.filter((d) => !d.online) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <p className="text-slate-400 text-sm">
          Real-time snapshot of every device on the network.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ClipboardList size={16} />
          )}
          Generate Muster Report
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {devices !== null && (
        <div className="space-y-3">
          {/* Online devices */}
          <div>
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              On-site ({online.length})
            </h3>
            {online.length === 0 ? (
              <p className="text-slate-500 text-sm">No devices online.</p>
            ) : (
              <ul className="divide-y divide-slate-700 rounded-lg overflow-hidden border border-slate-700">
                {online.map((d) => (
                  <DeviceRow key={d.id} device={d} />
                ))}
              </ul>
            )}
          </div>

          {/* Offline devices */}
          {offline.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Off-site / last seen ({offline.length})
              </h3>
              <ul className="divide-y divide-slate-800 rounded-lg overflow-hidden border border-slate-800">
                {offline.map((d) => (
                  <DeviceRow key={d.id} device={d} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeviceRow({ device }: { device: DeviceRecord }) {
  const displayName =
    device.user?.name ?? device.nickname ?? device.mac_address;
  const lastSeen = device.last_seen
    ? new Date(device.last_seen).toLocaleTimeString()
    : "never";

  return (
    <li className="flex items-center gap-3 px-4 py-3 bg-slate-800/60">
      {device.online ? (
        <Wifi size={16} className="text-emerald-400 shrink-0" />
      ) : (
        <WifiOff size={16} className="text-slate-600 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-slate-100 text-sm font-medium truncate">
          {displayName}
        </p>
        <p className="text-slate-500 text-xs truncate">{device.mac_address}</p>
      </div>
      <div className="text-right shrink-0">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            device.online
              ? "bg-emerald-900/60 text-emerald-300"
              : "bg-slate-700 text-slate-400"
          }`}
        >
          {device.online ? "Online" : lastSeen}
        </span>
      </div>
    </li>
  );
}
