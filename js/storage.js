import {
  DEFAULT_GOALS,
  LOCAL_STORAGE_KEY,
  DEFAULT_PATIENT_NAME,
  DEFAULT_GESTATIONAL_WEEK,
  newId,
} from "./config.js";

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return defaultLocalData();
    const data = { ...defaultLocalData(), ...JSON.parse(raw) };
    if (data.profile?.patient_name === "Bebe Grijalva Cruz") {
      data.profile.patient_name = DEFAULT_PATIENT_NAME;
      writeLocal(data);
    }
    if (data.profile && data.profile.gestational_week == null) {
      data.profile.gestational_week = DEFAULT_GESTATIONAL_WEEK;
      writeLocal(data);
    }
    return data;
  } catch {
    return defaultLocalData();
  }
}

function writeLocal(data) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

function defaultLocalData() {
  return {
    profile: {
      patient_name: DEFAULT_PATIENT_NAME,
      gestational_week: DEFAULT_GESTATIONAL_WEEK,
      goals: { ...DEFAULT_GOALS },
    },
    glucose: [],
    blood_pressure: [],
  };
}

export async function getProfile() {
  return readLocal().profile;
}

export async function saveProfile(profile) {
  const data = readLocal();
  data.profile = profile;
  writeLocal(data);
}

export async function listGlucose() {
  return readLocal().glucose.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
}

export async function saveGlucose(reading) {
  const record = { ...reading, id: reading.id || newId() };
  const data = readLocal();
  const idx = data.glucose.findIndex((r) => r.id === record.id);
  if (idx >= 0) data.glucose[idx] = record;
  else data.glucose.push(record);
  writeLocal(data);
  return record;
}

export async function deleteGlucose(id) {
  const data = readLocal();
  data.glucose = data.glucose.filter((r) => r.id !== id);
  writeLocal(data);
}

export async function listBloodPressure() {
  return readLocal().blood_pressure.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
}

export async function saveBloodPressure(reading) {
  const record = { ...reading, id: reading.id || newId() };
  const data = readLocal();
  const idx = data.blood_pressure.findIndex((r) => r.id === record.id);
  if (idx >= 0) data.blood_pressure[idx] = record;
  else data.blood_pressure.push(record);
  writeLocal(data);
  return record;
}

export async function deleteBloodPressure(id) {
  const data = readLocal();
  data.blood_pressure = data.blood_pressure.filter((r) => r.id !== id);
  writeLocal(data);
}

export async function exportAllData() {
  const data = readLocal();
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    profile: data.profile,
    glucose: data.glucose,
    blood_pressure: data.blood_pressure,
  };
}

export async function importAllData(payload, { merge = true } = {}) {
  const glucose = payload.glucose || payload.glucoseReadings || payload.readings?.glucose || [];
  const blood_pressure =
    payload.blood_pressure || payload.bloodPressure || payload.readings?.blood_pressure || [];

  const data = merge ? readLocal() : defaultLocalData();
  if (payload.profile) {
    data.profile = {
      patient_name: payload.profile.patient_name || payload.profile.name || data.profile.patient_name,
      gestational_week:
        payload.profile.gestational_week ?? data.profile.gestational_week ?? DEFAULT_GESTATIONAL_WEEK,
      goals: payload.profile.goals || data.profile.goals,
    };
  }
  const normalizedG = glucose.map(normalizeGlucoseImport);
  const normalizedBp = blood_pressure.map(normalizeBpImport);
  data.glucose = merge ? dedupeById([...normalizedG, ...data.glucose]) : normalizedG;
  data.blood_pressure = merge ? dedupeById([...normalizedBp, ...data.blood_pressure]) : normalizedBp;
  writeLocal(data);
}

export async function resetAllData() {
  const data = readLocal();
  data.glucose = [];
  data.blood_pressure = [];
  writeLocal(data);
}

/** Load optional backup committed in the repo (public/data/backup.json). */
export async function tryLoadRepoBackup({ onlyIfEmpty = false } = {}) {
  try {
    const local = readLocal();
    const empty = !local.glucose.length && !local.blood_pressure.length;
    if (onlyIfEmpty && !empty) return false;

    const base = import.meta.env.BASE_URL || "/";
    const res = await fetch(`${base}data/backup.json`, { cache: "no-cache" });
    if (!res.ok) return false;
    const payload = await res.json();
    await importAllData(payload, { merge: !empty && !onlyIfEmpty });
    return true;
  } catch {
    return false;
  }
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function normalizeGlucoseImport(raw) {
  const typeMap = {
    ayunas: "ayunas",
    fasting: "ayunas",
    "pre-comida": "pre_comida",
    pre_comida: "pre_comida",
    precomida: "pre_comida",
    "post-comida": "post_comida",
    post_comida: "post_comida",
    postcomida: "post_comida",
  };
  let glucose_type = raw.glucose_type || raw.type || raw.tipo || "ayunas";
  glucose_type = typeMap[String(glucose_type).toLowerCase().replace(/\s+/g, "_")] || glucose_type;
  if (String(raw.type || raw.tipo || "").toLowerCase().includes("ayunas")) glucose_type = "ayunas";
  if (String(raw.type || raw.tipo || "").toLowerCase().includes("pre")) glucose_type = "pre_comida";
  if (String(raw.type || raw.tipo || "").toLowerCase().includes("post")) glucose_type = "post_comida";

  let meal = raw.meal || raw.comida || null;
  if (meal) {
    const m = String(meal).toLowerCase();
    if (m.includes("almuerzo") || m.includes("lunch")) meal = "almuerzo";
    else if (m.includes("cena") || m.includes("dinner")) meal = "cena";
    else if (m.includes("desayuno") || m.includes("breakfast")) meal = "desayuno";
  }

  let hours_post = raw.hours_post ?? raw.horas ?? raw.hoursAfter ?? null;
  if (hours_post == null && raw.label) {
    const match = String(raw.label).match(/(\d)\s*h/i);
    if (match) hours_post = Number(match[1]);
  }
  if (hours_post != null) hours_post = Number(hours_post);

  const recorded_at = raw.recorded_at || raw.date || raw.timestamp || raw.fecha || new Date().toISOString();
  const value_mg_dl = Number(raw.value_mg_dl ?? raw.value ?? raw.glucose ?? raw.mg_dl ?? raw.valor);

  return {
    id: raw.id || newId(),
    recorded_at: new Date(recorded_at).toISOString(),
    glucose_type,
    value_mg_dl,
    meal:
      glucose_type === "ayunas"
        ? null
        : meal || (glucose_type === "pre_comida" ? "almuerzo" : "almuerzo"),
    hours_post: glucose_type === "post_comida" ? hours_post || 1 : null,
    notes: raw.notes || raw.notas || "",
  };
}

export function normalizeBpImport(raw) {
  const recorded_at = raw.recorded_at || raw.date || raw.timestamp || raw.fecha || new Date().toISOString();
  return {
    id: raw.id || newId(),
    recorded_at: new Date(recorded_at).toISOString(),
    systolic: Number(raw.systolic ?? raw.sistolica ?? raw.sys),
    diastolic: Number(raw.diastolic ?? raw.diastolica ?? raw.dia),
    pulse: raw.pulse != null ? Number(raw.pulse ?? raw.pulso) : null,
    arm: raw.arm || raw.brazo || "izquierdo",
    notes: raw.notes || raw.notas || "",
  };
}
