export const DEFAULT_GOALS = {
  fasting: 100,
  pre_meal: 110,
  post_1h: 140,
  post_2h: 120,
};

export const GLUCOSE_TYPES = {
  ayunas: { label: "Ayunas", short: "Ayunas" },
  pre_comida: { label: "Pre-Comida", short: "Pre-Comida" },
  post_comida: { label: "Post-Comida", short: "Post-Comida" },
};

export const MEALS = {
  almuerzo: "Almuerzo",
  cena: "Cena",
  desayuno: "Desayuno",
};

/** Comidas permitidas por tipo de lectura */
export const MEALS_BY_TYPE = {
  pre_comida: ["almuerzo", "cena"],
  post_comida: ["desayuno", "almuerzo", "cena"],
};

export const ARMS = {
  izquierdo: "Izquierdo",
  derecho: "Derecho",
};

export const LOCAL_STORAGE_KEY = "salud-monitor-data-v1";

export const DEFAULT_PATIENT_NAME = "Andy Grijalva Cruz";

/** Semana gestacional actual (tercer trimestre). */
export const DEFAULT_GESTATIONAL_WEEK = 33;

export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function toDatetimeLocalValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value) {
  return new Date(value).toISOString();
}

export function glucoseTypeLabel(reading) {
  const base = GLUCOSE_TYPES[reading.glucose_type]?.label || reading.glucose_type;
  if (reading.glucose_type === "pre_comida" && reading.meal) {
    const meal = MEALS[reading.meal] || reading.meal;
    return `Pre-Comida (${meal})`;
  }
  if (reading.glucose_type === "post_comida" && reading.meal) {
    const meal = MEALS[reading.meal] || reading.meal;
    const hrs = reading.hours_post === 2 ? " (2h)" : " (1h)";
    return `Post-Comida (${meal})${hrs}`;
  }
  return base;
}

export function glucoseGoal(reading, goals) {
  if (reading.glucose_type === "ayunas") return goals.fasting;
  if (reading.glucose_type === "pre_comida") return goals.pre_meal;
  if (reading.glucose_type === "post_comida") {
    return reading.hours_post === 2 ? goals.post_2h : goals.post_1h;
  }
  return goals.fasting;
}

export function isGlucoseInRange(reading, goals) {
  const goal = glucoseGoal(reading, goals);
  return reading.value_mg_dl <= goal;
}

/** Clasificación AHA: se usa la categoría más alta que aplique. */
export function classifyBloodPressure(systolic, diastolic) {
  if (systolic >= 140 || diastolic >= 90) {
    return { label: "Hipertensión etapa 2", className: "bp-high" };
  }
  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
    return { label: "Hipertensión etapa 1", className: "bp-high" };
  }
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
    return { label: "Presión arterial elevada", className: "bp-elevated" };
  }
  if (systolic < 120 && diastolic < 80) {
    return { label: "Presión arterial normal", className: "bp-normal" };
  }
  return { label: "Fuera de rango", className: "bp-elevated" };
}

export function newId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
