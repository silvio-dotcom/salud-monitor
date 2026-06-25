import {
  classifyBloodPressure,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  DEFAULT_GOALS,
  MEALS,
  MEALS_BY_TYPE,
} from "./config.js";
import {
  getProfile,
  saveProfile,
  listGlucose,
  saveGlucose,
  deleteGlucose,
  listBloodPressure,
  saveBloodPressure,
  deleteBloodPressure,
  importAllData,
  resetAllData,
  tryLoadRepoBackup,
} from "./storage.js";
import { renderGlucoseSummary, renderBpSummary } from "./dashboard.js";
import { renderGlucoseChart, renderBpChart } from "./charts.js";
import { computeGlucoseInsights, computeBpInsights, renderInsights } from "./insights.js";
import {
  renderHistory,
  filterReadings,
  bindHistoryActions,
  updateHistoryFilterOptions,
} from "./history.js";
import { downloadJsonExport, downloadPdfReport } from "./reports.js";
import { parseImportFile, validateImportPayload } from "./import.js";

const state = {
  tab: "glucose",
  chartRange: "90",
  profile: { patient_name: "Salud Monitor", goals: { ...DEFAULT_GOALS } },
  glucose: [],
  bloodPressure: [],
};

function toast(msg) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function refreshData() {
  const [profile, glucose, bloodPressure] = await Promise.all([
    getProfile(),
    listGlucose(),
    listBloodPressure(),
  ]);
  state.profile = profile;
  state.glucose = glucose;
  state.bloodPressure = bloodPressure;
  document.getElementById("patient-name").textContent = profile.patient_name;
  render();
}

function render() {
  const summaryEl = document.getElementById("summary-panel");
  const insightsEl = document.getElementById("insights-content");
  const chartTitle = document.getElementById("chart-title");
  const canvas = document.getElementById("main-chart");
  const listEl = document.getElementById("history-list");
  const emptyEl = document.getElementById("history-empty");
  const search = document.getElementById("history-search").value.trim();
  const typeFilter = document.getElementById("history-filter").value;

  if (state.tab === "glucose") {
    chartTitle.textContent = "Tendencia de Glucosa";
    renderGlucoseSummary(summaryEl, state.glucose, state.profile.goals);
    renderGlucoseChart(canvas, state.glucose, state.profile.goals, state.chartRange);
    renderInsights(insightsEl, computeGlucoseInsights(state.glucose, state.profile.goals));
    const filtered = filterReadings(state.glucose, { search, typeFilter, tab: "glucose" });
    renderHistory(listEl, emptyEl, filtered, {
      tab: "glucose",
      goals: state.profile.goals,
    });
  } else {
    chartTitle.textContent = "Tendencia de Presión Arterial";
    renderBpSummary(summaryEl, state.bloodPressure);
    renderBpChart(canvas, state.bloodPressure, state.chartRange);
    renderInsights(insightsEl, computeBpInsights(state.bloodPressure));
    const filtered = filterReadings(state.bloodPressure, { search, typeFilter, tab: "bp" });
    renderHistory(listEl, emptyEl, filtered, { tab: "bp", goals: state.profile.goals });
  }
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  updateHistoryFilterOptions(document.getElementById("history-filter"), tab);
  document.getElementById("history-search").value = "";
  render();
}

function openMeasureModal({ kind, record = null }) {
  const modal = document.getElementById("measure-modal");
  const form = document.getElementById("measure-form");
  form.reset();
  document.getElementById("measure-kind").value = kind;
  document.getElementById("measure-id").value = record?.id || "";
  document.getElementById("measure-modal-title").textContent = record
    ? "Editar Medida"
    : "Nueva Medida";

  const glucoseFields = document.getElementById("glucose-fields");
  const bpFields = document.getElementById("bp-fields");
  glucoseFields.classList.toggle("hidden", kind !== "glucose");
  bpFields.classList.toggle("hidden", kind !== "bp");

  const dt = record?.recorded_at || new Date().toISOString();
  document.getElementById("measure-datetime").value = toDatetimeLocalValue(dt);

  if (kind === "glucose" && record) {
    document.getElementById("measure-glucose-type").value = record.glucose_type;
    document.getElementById("measure-glucose-value").value = record.value_mg_dl;
    syncGlucoseFormFields(record.glucose_type, record.meal);
    document.getElementById("measure-hours-post").value = record.hours_post || 1;
    document.getElementById("measure-notes").value = record.notes || "";
  } else if (kind === "glucose") {
    syncGlucoseFormFields(document.getElementById("measure-glucose-type").value);
  }

  if (kind === "bp" && record) {
    document.getElementById("measure-systolic").value = record.systolic;
    document.getElementById("measure-diastolic").value = record.diastolic;
    document.getElementById("measure-pulse").value = record.pulse ?? "";
    document.getElementById("measure-arm").value = record.arm || "izquierdo";
    document.getElementById("measure-notes").value = record.notes || "";
    updateBpClassification();
  }

  if (kind === "glucose") {
    document.getElementById("measure-glucose-value").required = true;
    document.getElementById("measure-systolic").required = false;
    document.getElementById("measure-diastolic").required = false;
  } else {
    document.getElementById("measure-glucose-value").required = false;
    document.getElementById("measure-systolic").required = true;
    document.getElementById("measure-diastolic").required = true;
  }

  modal.showModal();
}

function populateMealOptions(type, selected) {
  const select = document.getElementById("measure-meal");
  const meals = MEALS_BY_TYPE[type] || [];
  select.innerHTML = meals
    .map((key) => `<option value="${key}">${MEALS[key]}</option>`)
    .join("");
  if (selected && !meals.includes(selected)) {
    const opt = document.createElement("option");
    opt.value = selected;
    opt.textContent = MEALS[selected] || selected;
    select.appendChild(opt);
  }
  if (selected) select.value = selected;
}

function syncGlucoseFormFields(type, selectedMeal) {
  const mealFields = document.getElementById("meal-fields");
  const hoursFields = document.getElementById("hours-post-fields");
  const showMeal = type === "pre_comida" || type === "post_comida";
  mealFields.classList.toggle("hidden", !showMeal);
  hoursFields.classList.toggle("hidden", type !== "post_comida");
  if (showMeal) populateMealOptions(type, selectedMeal);
}

function updateBpClassification() {
  const sys = Number(document.getElementById("measure-systolic").value);
  const dia = Number(document.getElementById("measure-diastolic").value);
  const el = document.getElementById("bp-classification");
  if (!sys || !dia) {
    el.textContent = "";
    el.className = "bp-classification";
    return;
  }
  const c = classifyBloodPressure(sys, dia);
  el.textContent = c.label;
  el.className = `bp-classification ${c.className}`;
}

async function handleMeasureSubmit(e) {
  e.preventDefault();
  const kind = document.getElementById("measure-kind").value;
  const id = document.getElementById("measure-id").value || undefined;
  const recorded_at = fromDatetimeLocalValue(document.getElementById("measure-datetime").value);
  const notes = document.getElementById("measure-notes").value.trim();

  try {
    if (kind === "glucose") {
      const glucose_type = document.getElementById("measure-glucose-type").value;
      const value_mg_dl = Number(document.getElementById("measure-glucose-value").value);
      if (!value_mg_dl) throw new Error("Ingresa un valor de glucosa.");
      await saveGlucose({
        id,
        recorded_at,
        glucose_type,
        value_mg_dl,
        meal:
          glucose_type === "pre_comida" || glucose_type === "post_comida"
            ? document.getElementById("measure-meal").value
            : null,
        hours_post:
          glucose_type === "post_comida"
            ? Number(document.getElementById("measure-hours-post").value)
            : null,
        notes,
      });
    } else {
      const systolic = Number(document.getElementById("measure-systolic").value);
      const diastolic = Number(document.getElementById("measure-diastolic").value);
      const pulseVal = document.getElementById("measure-pulse").value;
      if (!systolic || !diastolic) throw new Error("Ingresa sistólica y diastólica.");
      await saveBloodPressure({
        id,
        recorded_at,
        systolic,
        diastolic,
        pulse: pulseVal ? Number(pulseVal) : null,
        arm: document.getElementById("measure-arm").value,
        notes,
      });
    }
    document.getElementById("measure-modal").close();
    toast("Medida guardada");
    await refreshData();
  } catch (err) {
    toast(err.message || "Error al guardar");
  }
}

function bindUi() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.chartRange = btn.dataset.range;
      render();
    });
  });

  document.getElementById("fab-new").addEventListener("click", () => {
    openMeasureModal({ kind: state.tab === "glucose" ? "glucose" : "bp" });
  });

  document.getElementById("measure-form").addEventListener("submit", handleMeasureSubmit);
  document.getElementById("measure-glucose-type").addEventListener("change", (e) => {
    syncGlucoseFormFields(e.target.value);
  });
  document.getElementById("measure-systolic").addEventListener("input", updateBpClassification);
  document.getElementById("measure-diastolic").addEventListener("input", updateBpClassification);

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  });

  document.getElementById("history-search").addEventListener("input", render);
  document.getElementById("history-filter").addEventListener("change", render);
  document.getElementById("refresh-insights").addEventListener("click", render);

  bindHistoryActions(document.getElementById("history-list"), {
    onEdit: (id) => {
      if (state.tab === "glucose") {
        const record = state.glucose.find((r) => r.id === id);
        if (record) openMeasureModal({ kind: "glucose", record });
      } else {
        const record = state.bloodPressure.find((r) => r.id === id);
        if (record) openMeasureModal({ kind: "bp", record });
      }
    },
    onDelete: async (id) => {
      if (!confirm("¿Eliminar este registro?")) return;
      if (state.tab === "glucose") await deleteGlucose(id);
      else await deleteBloodPressure(id);
      toast("Registro eliminado");
      await refreshData();
    },
  });

  document.getElementById("export-json-btn").addEventListener("click", async () => {
    await downloadJsonExport();
    toast("JSON exportado");
  });

  document.getElementById("export-pdf-btn").addEventListener("click", async () => {
    await downloadPdfReport();
    toast("PDF generado");
  });

  document.getElementById("import-json-input").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = parseImportFile(text);
      const errors = validateImportPayload(payload);
      if (errors.length) throw new Error(errors[0]);
      const merge = confirm("¿Combinar con datos existentes? Cancelar = reemplazar todo.");
      await importAllData(payload, { merge });
      toast(`Importados ${payload.glucose.length} glucosa, ${payload.blood_pressure.length} presión`);
      await refreshData();
    } catch (err) {
      toast(err.message || "Error al importar");
    }
    e.target.value = "";
  });

  document.getElementById("reset-data-btn").addEventListener("click", async () => {
    if (!confirm("¿Eliminar TODO el historial? Esta acción no se puede deshacer.")) return;
    if (!confirm("Confirma de nuevo: se borrarán todos los registros.")) return;
    await resetAllData();
    toast("Historial reiniciado");
    await refreshData();
  });

  document.getElementById("load-repo-backup-btn")?.addEventListener("click", async () => {
    const loaded = await tryLoadRepoBackup();
    toast(loaded ? "Backup del repositorio cargado" : "No hay data/backup.json en el sitio");
    if (loaded) await refreshData();
  });

  document.getElementById("settings-btn").addEventListener("click", () => {
    const modal = document.getElementById("settings-modal");
    document.getElementById("settings-patient-name").value = state.profile.patient_name;
    const g = state.profile.goals;
    document.getElementById("goal-fasting").value = g.fasting;
    document.getElementById("goal-pre").value = g.pre_meal;
    document.getElementById("goal-post1").value = g.post_1h;
    document.getElementById("goal-post2").value = g.post_2h;
    modal.showModal();
  });

  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const profile = {
      patient_name: document.getElementById("settings-patient-name").value.trim() || "Salud Monitor",
      goals: {
        fasting: Number(document.getElementById("goal-fasting").value) || DEFAULT_GOALS.fasting,
        pre_meal: Number(document.getElementById("goal-pre").value) || DEFAULT_GOALS.pre_meal,
        post_1h: Number(document.getElementById("goal-post1").value) || DEFAULT_GOALS.post_1h,
        post_2h: Number(document.getElementById("goal-post2").value) || DEFAULT_GOALS.post_2h,
      },
    };
    await saveProfile(profile);
    document.getElementById("settings-modal").close();
    toast("Configuración guardada");
    await refreshData();
  });

  updateHistoryFilterOptions(document.getElementById("history-filter"), state.tab);
}

async function bootstrap() {
  bindUi();
  const restored = await tryLoadRepoBackup({ onlyIfEmpty: true });
  if (restored) toast("Datos cargados desde data/backup.json");
  else if (import.meta.env.DEV) await maybeSeedDemo();
  await refreshData();
}

bootstrap();

async function maybeSeedDemo() {
  const glucose = await listGlucose();
  if (glucose.length) return;
  const now = Date.now();
  const day = 86400000;
  const samples = [
    { glucose_type: "ayunas", value_mg_dl: 94, offset: 0 },
    { glucose_type: "post_comida", value_mg_dl: 115, meal: "almuerzo", hours_post: 1, offset: day },
    { glucose_type: "ayunas", value_mg_dl: 89, offset: day * 2 },
  ];
  for (const s of samples) {
    await saveGlucose({
      recorded_at: new Date(now - s.offset).toISOString(),
      glucose_type: s.glucose_type,
      value_mg_dl: s.value_mg_dl,
      meal: s.meal || null,
      hours_post: s.hours_post || null,
      notes: "",
    });
  }
}
