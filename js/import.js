/**
 * Flexible import parser for legacy app exports and common JSON shapes.
 */
import { normalizeGlucoseImport, normalizeBpImport } from "./storage.js";

const LEGACY_TYPE_PATTERNS = [
  { re: /ayunas|fasting|en ayunas/i, type: "ayunas" },
  { re: /pre[- ]?comida|before meal|pre meal/i, type: "pre_comida" },
  { re: /post[- ]?comida|after meal|post meal|posprandial/i, type: "post_comida" },
];

export function parseImportFile(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error("El archivo no es JSON válido.");
  }
  return normalizeImportPayload(raw);
}

export function normalizeImportPayload(raw) {
  if (Array.isArray(raw)) {
    return {
      glucose: raw.filter(isLikelyGlucose).map(normalizeLegacyGlucose),
      blood_pressure: raw.filter(isLikelyBp).map(normalizeBpImport),
      profile: null,
    };
  }

  const glucose =
    raw.glucose ||
    raw.glucoseReadings ||
    raw.glucose_readings ||
    raw.readings?.glucose ||
    raw.data?.glucose ||
    raw.mediciones?.glucosa ||
    [];

  const blood_pressure =
    raw.blood_pressure ||
    raw.bloodPressure ||
    raw.bp_readings ||
    raw.readings?.blood_pressure ||
    raw.readings?.bloodPressure ||
    raw.data?.blood_pressure ||
    raw.mediciones?.presion ||
    [];

  const profile =
    raw.profile ||
    raw.paciente ||
    (raw.patientName || raw.patient_name
      ? { patient_name: raw.patientName || raw.patient_name, goals: raw.goals || raw.metas }
      : null);

  const glucoseList = Array.isArray(glucose) ? glucose : Object.values(glucose);
  const bpList = Array.isArray(blood_pressure) ? blood_pressure : Object.values(blood_pressure);

  return {
    profile,
    glucose: glucoseList.map((r) => normalizeLegacyGlucose(r)),
    blood_pressure: bpList.map((r) => normalizeBpImport(r)),
  };
}

function isLikelyGlucose(r) {
  return (
    r.value_mg_dl != null ||
    r.glucose != null ||
    r.mg_dl != null ||
    r.valor != null ||
    (r.type && /glucosa|ayunas|comida|mg/i.test(String(r.type))) ||
    (r.tipo && /glucosa|ayunas|comida|mg/i.test(String(r.tipo)))
  );
}

function isLikelyBp(r) {
  return r.systolic != null || r.sistolica != null || r.diastolic != null || r.diastolica != null;
}

function normalizeLegacyGlucose(raw) {
  const copy = { ...raw };
  const label = String(raw.type || raw.tipo || raw.label || raw.categoria || "");
  if (!copy.glucose_type) {
    for (const { re, type } of LEGACY_TYPE_PATTERNS) {
      if (re.test(label)) {
        copy.glucose_type = type;
        break;
      }
    }
  }
  if (label.match(/almuerzo|lunch/i)) copy.meal = "almuerzo";
  if (label.match(/cena|dinner/i)) copy.meal = "cena";
  if (label.match(/desayuno|breakfast/i)) copy.meal = "desayuno";
  const hrMatch = label.match(/\((\d)\s*h\)/i) || label.match(/(\d)\s*hora/i);
  if (hrMatch) copy.hours_post = Number(hrMatch[1]);
  return normalizeGlucoseImport(copy);
}

export function validateImportPayload(payload) {
  const errors = [];
  if (!payload.glucose?.length && !payload.blood_pressure?.length) {
    errors.push("No se encontraron lecturas de glucosa ni presión.");
  }
  for (const g of payload.glucose || []) {
    if (!g.value_mg_dl || Number.isNaN(g.value_mg_dl)) {
      errors.push(`Glucosa inválida en ${g.recorded_at || "fecha desconocida"}`);
    }
  }
  for (const b of payload.blood_pressure || []) {
    if (!b.systolic || !b.diastolic) {
      errors.push(`Presión inválida en ${b.recorded_at || "fecha desconocida"}`);
    }
  }
  return errors;
}
