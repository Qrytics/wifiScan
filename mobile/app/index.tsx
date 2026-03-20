/**
 * OmniPresence — Dashboard Screen (Phase 4)
 *
 * Features:
 *   • Large "Current Occupancy" ring at the top
 *   • "Who's Here" list with Lucide icons
 *   • Ghost Mode toggle that PATCHes the API
 *   • Guest Alert banner when an unknown device is detected
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Eye, EyeOff, UserX, Wifi, WifiOff } from "lucide-react-native";

// ---------------------------------------------------------------------------
// Config — update to match your backend host
// ---------------------------------------------------------------------------
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Resident {
  name: string;
  is_ghost: boolean;
}

interface StatusResponse {
  total_count: number;
  present: Resident[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Occupancy ring
// ---------------------------------------------------------------------------
function OccupancyRing({ count }: { count: number }) {
  return (
    <View className="items-center justify-center my-8">
      <View className="w-44 h-44 rounded-full border-4 border-indigo-500 items-center justify-center bg-slate-800 shadow-lg shadow-indigo-500/30">
        <Text className="text-6xl font-bold text-white">{count}</Text>
        <Text className="text-slate-400 text-sm mt-1 tracking-widest uppercase">
          Present
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Resident row
// ---------------------------------------------------------------------------
function ResidentRow({ resident }: { resident: Resident }) {
  return (
    <View className="flex-row items-center px-5 py-3 border-b border-slate-700/50">
      <View className="w-9 h-9 rounded-full bg-indigo-600 items-center justify-center mr-3">
        {resident.is_ghost ? (
          <UserX size={18} color="#f8fafc" />
        ) : (
          <Wifi size={18} color="#f8fafc" />
        )}
      </View>
      <Text
        className={`flex-1 text-base font-medium ${
          resident.is_ghost ? "text-slate-400 italic" : "text-slate-100"
        }`}
      >
        {resident.name}
      </Text>
      {resident.is_ghost && (
        <View className="bg-slate-700 rounded-full px-2 py-0.5">
          <Text className="text-xs text-slate-400">ghost</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Guest Alert banner
// ---------------------------------------------------------------------------
function GuestAlertBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View className="mx-4 mb-4 bg-amber-500/20 border border-amber-500 rounded-xl p-4 flex-row items-center">
      <WifiOff size={20} color="#f59e0b" style={{ marginRight: 10 }} />
      <Text className="flex-1 text-amber-300 text-sm font-medium">
        Unknown device detected on your network!
      </Text>
      <TouchableOpacity onPress={onDismiss}>
        <Text className="text-amber-400 font-bold ml-2">✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function DashboardScreen() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [guestAlert, setGuestAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatusResponse = await res.json();
      setStatus(data);

      // Show guest alert if any unknown (non-ghost, no user) device appears
      const hasUnknown = data.present.some(
        (p) => !p.is_ghost && p.name === "Unknown Device"
      );
      setGuestAlert(hasUnknown);
      setError(null);
    } catch (err) {
      setError("Could not reach OmniPresence server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleGhostToggle = async (value: boolean) => {
    setGhostMode(value);
    // In a real app, pass the actual user ID; here we use 1 as a placeholder
    try {
      await fetch(`${API_BASE}/users/1/ghost`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: 1, is_ghost: value }),
      });
      await fetchStatus();
    } catch {
      // silently fail — toggle will revert on next status poll
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="text-slate-400 mt-4">Scanning network…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <WifiOff size={48} color="#ef4444" />
        <Text className="text-red-400 text-center mt-4 text-base">{error}</Text>
        <TouchableOpacity
          onPress={fetchStatus}
          className="mt-6 bg-indigo-600 px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-900"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
        />
      }
    >
      {/* Header */}
      <View className="px-5 pt-6 pb-2">
        <Text className="text-2xl font-bold text-white tracking-tight">
          OmniPresence
        </Text>
        <Text className="text-slate-400 text-sm mt-0.5">
          Wi-Fi Presence · Home
        </Text>
      </View>

      {/* Occupancy ring */}
      <OccupancyRing count={status?.total_count ?? 0} />

      {/* Guest Alert */}
      {guestAlert && <GuestAlertBanner onDismiss={() => setGuestAlert(false)} />}

      {/* Ghost Mode toggle */}
      <View className="mx-4 mb-4 bg-slate-800 rounded-xl px-5 py-4 flex-row items-center justify-between border border-slate-700">
        <View className="flex-row items-center">
          {ghostMode ? (
            <EyeOff size={20} color="#a5b4fc" style={{ marginRight: 10 }} />
          ) : (
            <Eye size={20} color="#a5b4fc" style={{ marginRight: 10 }} />
          )}
          <View>
            <Text className="text-slate-100 font-semibold">Ghost Mode</Text>
            <Text className="text-slate-400 text-xs">
              {ghostMode ? "Your name is hidden" : "Your name is visible"}
            </Text>
          </View>
        </View>
        <Switch
          value={ghostMode}
          onValueChange={handleGhostToggle}
          trackColor={{ false: "#334155", true: "#4f46e5" }}
          thumbColor={ghostMode ? "#6366f1" : "#94a3b8"}
        />
      </View>

      {/* Who's Here */}
      <View className="mx-4 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-8">
        <View className="px-5 py-3 border-b border-slate-700">
          <Text className="text-slate-200 font-semibold text-base">
            Who's Here
          </Text>
        </View>
        {status && status.present.length > 0 ? (
          <FlatList
            data={status.present}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => <ResidentRow resident={item} />}
            scrollEnabled={false}
          />
        ) : (
          <View className="items-center py-10">
            <WifiOff size={32} color="#475569" />
            <Text className="text-slate-500 mt-3">Nobody home right now</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
