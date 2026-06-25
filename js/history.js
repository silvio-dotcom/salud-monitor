import {
  formatDateTime,
  glucoseTypeLabel,
  isGlucoseInRange,
  classifyBloodPressure,
  ARMS,
} from "./config.js";

export function renderHistory(listEl, emptyEl, readings, { tab, goals, onEdit, onDelete }) {
  if (!readings.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  listEl.innerHTML = readings
    .map((r) => {
      if (tab === "glucose") return glucoseRow(r, goals, onEdit, onDelete);
      return bpRow(r, onEdit, onDelete);
    })
    .join("");
}

function glucoseRow(r, goals, onEdit, onDelete) {
  const inRange = isGlucoseInRange(r, goals);
  const rangeClass = inRange ? "in-range" : "out-range";
  return `
    <li class="history-item" data-id="${r.id}">
      <div class="history-main">
        <div class="history-date">${formatDateTime(r.recorded_at)}</div>
        <div class="history-type">${glucoseTypeLabel(r)}</div>
      </div>
      <div class="history-value ${rangeClass}">${r.value_mg_dl} <span class="summary-unit">mg/dL</span></div>
      <div class="history-actions">
        <button type="button" data-action="edit" data-id="${r.id}" aria-label="Editar">✎</button>
        <button type="button" data-action="delete" data-id="${r.id}" aria-label="Eliminar">🗑</button>
      </div>
    </li>`;
}

function bpRow(r, onEdit, onDelete) {
  const c = classifyBloodPressure(r.systolic, r.diastolic);
  const rangeClass = c.className === "bp-normal" ? "in-range" : "out-range";
  const arm = r.arm ? ` · ${ARMS[r.arm] || r.arm}` : "";
  const pulse = r.pulse ? ` · ${r.pulse} lpm` : "";
  return `
    <li class="history-item" data-id="${r.id}">
      <div class="history-main">
        <div class="history-date">${formatDateTime(r.recorded_at)}</div>
        <div class="history-type">${c.label}${arm}${pulse}</div>
      </div>
      <div class="history-value ${rangeClass}">${r.systolic}/${r.diastolic} <span class="summary-unit">mmHg</span></div>
      <div class="history-actions">
        <button type="button" data-action="edit" data-id="${r.id}" aria-label="Editar">✎</button>
        <button type="button" data-action="delete" data-id="${r.id}" aria-label="Eliminar">🗑</button>
      </div>
    </li>`;
}

export function filterReadings(readings, { search, typeFilter, tab }) {
  let result = [...readings];
  if (typeFilter && typeFilter !== "all") {
    if (tab === "glucose") result = result.filter((r) => r.glucose_type === typeFilter);
    else result = result.filter((r) => classifyBloodPressure(r.systolic, r.diastolic).className.includes(typeFilter));
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((r) => {
      if (tab === "glucose") {
        return (
          glucoseTypeLabel(r).toLowerCase().includes(q) ||
          String(r.value_mg_dl).includes(q) ||
          (r.notes || "").toLowerCase().includes(q)
        );
      }
      return (
        `${r.systolic}/${r.diastolic}`.includes(q) ||
        (r.notes || "").toLowerCase().includes(q)
      );
    });
  }
  return result;
}

export function bindHistoryActions(listEl, handlers) {
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit") handlers.onEdit(id);
    if (btn.dataset.action === "delete") handlers.onDelete(id);
  });
}

export function updateHistoryFilterOptions(selectEl, tab) {
  if (tab === "glucose") {
    selectEl.innerHTML = `
      <option value="all">Todos</option>
      <option value="ayunas">Ayunas</option>
      <option value="pre_comida">Pre-Comida</option>
      <option value="post_comida">Post-Comida</option>`;
  } else {
    selectEl.innerHTML = `
      <option value="all">Todos</option>
      <option value="normal">Normal</option>
      <option value="elevated">Elevada</option>
      <option value="high">Alta</option>`;
  }
}
