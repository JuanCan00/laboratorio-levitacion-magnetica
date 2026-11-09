/**
 * verify-lab.mjs
 * Suite de verificación funcional para el Laboratorio Virtual de Levitación Magnética
 * con unidades reales del Sistema Internacional (Teslas, Amperios, cm, g, kg, N, kN).
 */

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { LevitronPhysics, G_ACCEL } from '../js/physics/LevitronPhysics.js';
import { MaglevPhysics } from '../js/physics/MaglevPhysics.js';

console.log('=== INICIANDO PRUEBAS DEL LABORATORIO DE LEVITACIÓN MAGNÉTICA (UNIDADES SI) ===\n');

// 1. Verificar enlaces DOM en index.html
const html = fs.readFileSync('index.html', 'utf8');
const mainJs = fs.readFileSync('js/main.js', 'utf8');
const panelJs = fs.readFileSync('js/ui/PhysicsPanel.js', 'utf8');

const idRegex = /getElementById\('([^']+)'\)/g;
const allReferencedIds = [
  ...[...mainJs.matchAll(idRegex)].map((m) => m[1]),
  ...[...panelJs.matchAll(idRegex)].map((m) => m[1])
];

for (const id of allReferencedIds) {
  assert.ok(html.includes(`id="${id}"`), `Falta el ID #${id} en index.html`);
}
console.log(`✔ [DOM] Los ${allReferencedIds.length} IDs referenciados en JS existen en index.html.`);

// 2. Pruebas del Motor Físico A: LEVITRON (en Teslas y cm)
const lev = new LevitronPhysics();

for (let i = 0; i < 60; i++) lev.step(1 / 60);
assert.equal(lev.telemetry.status, 'ESTABLE', 'El Levitron en configuración nominal (0.98 T) debe ser ESTABLE');
assert.ok(
  Math.abs(lev.telemetry.gravityForceN - 0.028 * G_ACCEL) < 1e-4,
  'Fg debe ser exactamente m * 9.81'
);
console.log(
  `✔ [Levitron - Estable] Campo: ${lev.telemetry.magneticFieldTesla} T (${lev.telemetry.magnetMaterial}), Altura: ${lev.telemetry.heightCm.toFixed(2)} cm, Fg: ${lev.telemetry.gravityForceN.toFixed(3)} N`
);

// 2.2 Teorema de Earnshaw: Sin rotación (0 RPM) no puede haber levitación estable
lev.setParams({ spinRpm: 0 });
for (let i = 0; i < 90; i++) lev.step(1 / 60);
assert.equal(lev.telemetry.status, 'INESTABLE');
assert.ok(lev.telemetry.tiltDeg > 35);
console.log(
  `✔ [Levitron - Earnshaw 0 RPM] Estado: ${lev.telemetry.status}, Inclinación: ${lev.telemetry.tiltDeg}°, Altura cayó a: ${lev.telemetry.heightCm.toFixed(2)} cm`
);

// 2.3 Fuerza insuficiente con masa alta (75 g) e imán de Ferrita (0.28 T)
lev.reset();
lev.setParams({ spinRpm: 1850, magneticFieldTesla: 0.28, massGrams: 75, baseMagnetSize: 3.0 });
lev.step(1 / 60);
assert.equal(lev.telemetry.status, 'FUERZA INSUFICIENTE');
console.log(`✔ [Levitron - Fuerza Insuficiente (0.28 T)] Estado: ${lev.telemetry.status}`);

// 2.4 Sistema desactivado con campo 0.00 T
lev.setParams({ magneticFieldTesla: 0.0 });
lev.step(1 / 60);
assert.equal(lev.telemetry.status, 'SISTEMA DESACTIVADO');
console.log(`✔ [Levitron - Desactivado (0.00 T)] Estado: ${lev.telemetry.status}`);

// 3. Pruebas del Motor Físico B: TREN MAGLEV (en Teslas y Amperios)
const mag = new MaglevPhysics();

// 3.1 Separación entre suspensión y propulsión: a velocidad 0 km/h sigue levitando con 3.75 T y 750 A
mag.setParams({
  speedKmh: 0,
  trainMassKg: 2800,
  magneticFieldTesla: 3.75,
  electricCurrentAmps: 750,
  desiredHeightCm: 12,
  coilSpacingCm: 30
});
for (let i = 0; i < 60; i++) mag.step(1 / 60);
assert.equal(mag.telemetry.status, 'ESTABLE');
assert.ok(mag.telemetry.actualHeightCm > 10);
assert.equal(mag.telemetry.speedKmh, 0);
console.log(
  `✔ [Maglev - Suspensión a 0 km/h (3.75 T, 750 A)] Estado: ${mag.telemetry.status}, Altura: ${mag.telemetry.actualHeightCm.toFixed(2)} cm`
);

// 3.2 Estado INESTABLE al aumentar excesivamente la separación entre electroimanes (90 cm)
mag.setParams({ speedKmh: 200, coilSpacingCm: 90 });
for (let i = 0; i < 60; i++) mag.step(1 / 60);
assert.equal(mag.telemetry.status, 'INESTABLE');
console.log(`✔ [Maglev - Separación excesiva 90 cm] Estado: ${mag.telemetry.status}`);

// 3.3 Estado FUERZA INSUFICIENTE con masa pesada (9000 kg), campo bajo (1.5 T) y corriente baja (200 A)
mag.setParams({ trainMassKg: 9000, electricCurrentAmps: 200, magneticFieldTesla: 1.5, coilSpacingCm: 35 });
for (let i = 0; i < 60; i++) mag.step(1 / 60);
assert.equal(mag.telemetry.status, 'FUERZA INSUFICIENTE');
console.log(`✔ [Maglev - Fuerza Insuficiente (1.5 T, 200 A)] Estado: ${mag.telemetry.status}`);

// 3.4 Estado SISTEMA DESACTIVADO cuando corriente = 0 A
mag.setParams({ electricCurrentAmps: 0 });
mag.step(1 / 60);
assert.equal(mag.telemetry.status, 'SISTEMA DESACTIVADO');
assert.equal(mag.telemetry.electromagneticForceN, 0);
console.log(`✔ [Maglev - Sistema Desactivado (0 A)] Estado: ${mag.telemetry.status}`);

console.log('\n=== TODAS LAS PRUEBAS CON UNIDADES FÍSICAS REALES PASARON EXITOSAMENTE ===');
