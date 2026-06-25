import { classifyBloodPressure, isGlucoseInRange, glucoseGoal } from "./config.js";

const PAWS = "🐾🐾";

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function buildSaveCelebration({ kind, payload, goals }) {
  if (kind === "glucose") return buildGlucoseCelebration(payload, goals);
  return buildBpCelebration(payload);
}

function buildGlucoseCelebration(reading, goals) {
  const value = reading.value_mg_dl;
  const inRange = isGlucoseInRange(reading, goals);
  const goal = glucoseGoal(reading, goals);
  const overBy = value - goal;

  if (inRange) {
    const variant = pick([
      {
        title: "¡Ronroneos!",
        message: `Ronroneos de felicidad, tus niveles están perfectos. ${PAWS}`,
        emoji: "🐱",
      },
      {
        title: "¡Miau perfecto!",
        message: `Lectura impecable — tu gato interno está muy orgulloso. ${PAWS}`,
        emoji: "😺",
      },
      {
        title: "¡Zarpazo de éxito!",
        message: `En rango y feliz como un gato con su caja favorita. ${PAWS}`,
        emoji: "🐈",
      },
    ]);
    return { ...variant, value: String(value), unit: "mg/dL" };
  }

  if (overBy <= 25) {
    return {
      title: "¡Casi ronroneos!",
      message: `Un poquito arriba de la meta, pero seguimos cuidándote con amor felino. ${PAWS}`,
      emoji: "🐱",
      value: String(value),
      unit: "mg/dL",
    };
  }

  return {
    title: "¡Registrado, minino!",
    message: `Dato guardado con cariño. Compártelo con tu médico si lo ves repetir. ${PAWS}`,
    emoji: "🙀",
    value: String(value),
    unit: "mg/dL",
  };
}

function buildBpCelebration(reading) {
  const { systolic, diastolic } = reading;
  const { className } = classifyBloodPressure(systolic, diastolic);
  const value = `${systolic}/${diastolic}`;

  if (className === "bp-normal") {
    const variant = pick([
      {
        title: "¡Ronroneos!",
        message: `Presión en zona felina — tranquilo como una siesta al sol. ${PAWS}`,
        emoji: "🐱",
      },
      {
        title: "¡Miau zen!",
        message: `Lectura en calma — ronroneos de bienestar para ti. ${PAWS}`,
        emoji: "😸",
      },
    ]);
    return { ...variant, value, unit: "mmHg" };
  }

  if (className === "bp-elevated") {
    return {
      title: "¡Gato alerta!",
      message: `Un poquito elevada. Respira profundo, descansa y sigue el seguimiento. ${PAWS}`,
      emoji: "🐱",
      value,
      unit: "mmHg",
    };
  }

  return {
    title: "¡Anotado, miau!",
    message: `Quedó registrado para tu control. Consulta con tu médico — estamos contigo. ${PAWS}`,
    emoji: "🐾",
    value,
    unit: "mmHg",
  };
}
