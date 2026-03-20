const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export interface Resident {
  name: string;
  is_ghost: boolean;
}

export interface StatusResponse {
  total_count: number;
  present: Resident[];
  timestamp: string;
}

export interface DeviceRecord {
  id: number;
  mac_address: string;
  nickname: string | null;
  is_resident: boolean;
  last_seen: string | null;
  online: boolean;
  user: { id: number; name: string; is_ghost: boolean } | null;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  avg_count: number;
  max_count: number;
}

export interface AnalyticsResponse {
  period_days: number;
  heatmap: HeatmapCell[];
  generated_at: string;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchDevices(): Promise<DeviceRecord[]> {
  const res = await fetch(`${API_BASE}/devices`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const res = await fetch(`${API_BASE}/analytics`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
