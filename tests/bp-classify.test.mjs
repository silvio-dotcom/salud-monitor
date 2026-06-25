import assert from "node:assert/strict";
import { classifyBloodPressure } from "../js/config.js";

const cases = [
  [121, 81, "Presión arterial normal", "bp-normal"],
  [120, 80, "Presión arterial normal", "bp-normal"],
  [119, 79, "Presión arterial normal", "bp-normal"],
  [122, 81, "Presión arterial elevada", "bp-elevated"],
  [129, 81, "Presión arterial elevada", "bp-elevated"],
  [122, 82, "Hipertensión etapa 1", "bp-high"],
  [118, 82, "Hipertensión etapa 1", "bp-high"],
  [125, 85, "Hipertensión etapa 1", "bp-high"],
  [130, 75, "Hipertensión etapa 1", "bp-high"],
  [139, 89, "Hipertensión etapa 1", "bp-high"],
  [140, 85, "Hipertensión etapa 2", "bp-high"],
  [135, 90, "Hipertensión etapa 2", "bp-high"],
  [115, 95, "Hipertensión etapa 2", "bp-high"],
];

for (const [sys, dia, label, className] of cases) {
  const result = classifyBloodPressure(sys, dia);
  assert.equal(result.label, label, `${sys}/${dia} label`);
  assert.equal(result.className, className, `${sys}/${dia} class`);
}

console.log(`OK: ${cases.length} blood pressure classifications`);
