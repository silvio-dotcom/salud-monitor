/**
 * Run: node tests/import.test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { parseImportFile, validateImportPayload } from "../js/import.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "fixtures/legacy-export.json"), "utf8");

const payload = parseImportFile(fixture);
assert.equal(payload.glucose.length, 3);
assert.equal(payload.blood_pressure.length, 1);
assert.equal(payload.profile.patient_name, "Andy Grijalva Cruz");
assert.equal(payload.glucose[0].glucose_type, "ayunas");
assert.equal(payload.glucose[0].value_mg_dl, 94);
assert.equal(payload.glucose[1].glucose_type, "post_comida");
assert.equal(payload.glucose[1].hours_post, 1);
assert.equal(payload.blood_pressure[0].systolic, 118);

const errors = validateImportPayload(payload);
assert.equal(errors.length, 0);

console.log("import.test.mjs: all passed");
