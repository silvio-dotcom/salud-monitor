import { exportAllData } from "./storage.js";

export async function uploadBackupToGitHub(payload) {
  const url = import.meta.env.VITE_BACKUP_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url) {
    return { ok: false, reason: "not_configured" };
  }

  const headers = { "Content-Type": "application/json" };
  if (anonKey) headers.Authorization = `Bearer ${anonKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `No se pudo respaldar (${res.status})`);
  }
  return { ok: true, ...data };
}

export async function downloadLocalBackup(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salud-monitor-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function runBackup({ onCloud, onLocalFallback }) {
  const payload = await exportAllData();
  const cloud = await uploadBackupToGitHub(payload);
  if (cloud.ok) {
    onCloud?.(cloud);
    return { mode: "github", ...cloud };
  }
  if (cloud.reason === "not_configured") {
    await downloadLocalBackup(payload);
    onLocalFallback?.(payload);
    return { mode: "download", glucose: payload.glucose.length, bp: payload.blood_pressure.length };
  }
  throw new Error("Respaldo fallido");
}
