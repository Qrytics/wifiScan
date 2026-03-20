/**
 * Geofencing Background Task (Phase 5)
 *
 * Registers an Expo-Location geofence around the home coordinates.
 * When the user *enters* the zone it POSTs a heartbeat to the backend
 * so the Ghost Scanner prioritises scanning for their device.
 *
 * Usage
 * -----
 * Call `registerGeofenceTask(mac, lat, lng)` once after the user logs in
 * (requires always-on location permission).
 */

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

const TASK_NAME = "OMNIPRESENCE_GEOFENCE";
const GEOFENCE_RADIUS_M = 100;
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Task definition — must be at module level (outside any component)
// ---------------------------------------------------------------------------
TaskManager.defineTask(
  TASK_NAME,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  }>) => {
    if (error) {
      console.error("[Geofence] Task error:", error.message);
      return;
    }

    const { eventType, region } = data;

    if (eventType === Location.GeofencingEventType.Enter) {
      console.log("[Geofence] Entered home zone — notifying scanner.");

      const mac = region.identifier; // we store the MAC in the identifier
      try {
        await fetch(`${API_BASE}/geofence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mac_address: mac,
            latitude: region.latitude,
            longitude: region.longitude,
          }),
        });
        console.log("[Geofence] Heartbeat sent for", mac);
      } catch (fetchErr) {
        console.warn("[Geofence] Failed to send heartbeat:", fetchErr);
      }
    }
  }
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request always-on location permission and start monitoring a 100 m
 * geofence around (latitude, longitude).  The device's MAC address is
 * stored in the region identifier so the background task can include it
 * in the heartbeat payload.
 */
export async function registerGeofenceTask(
  macAddress: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") {
    console.warn("[Geofence] Background location permission denied.");
    return;
  }

  const alreadyRunning = await Location.hasStartedGeofencingAsync(TASK_NAME);
  if (alreadyRunning) {
    await Location.stopGeofencingAsync(TASK_NAME);
  }

  await Location.startGeofencingAsync(TASK_NAME, [
    {
      identifier: macAddress,
      latitude,
      longitude,
      radius: GEOFENCE_RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: false,
    },
  ]);

  console.log(
    `[Geofence] Monitoring ${GEOFENCE_RADIUS_M} m zone at (${latitude}, ${longitude}) for ${macAddress}`
  );
}

/** Stop the geofence monitor (e.g. when the user logs out). */
export async function unregisterGeofenceTask(): Promise<void> {
  const running = await Location.hasStartedGeofencingAsync(TASK_NAME);
  if (running) {
    await Location.stopGeofencingAsync(TASK_NAME);
    console.log("[Geofence] Monitoring stopped.");
  }
}
