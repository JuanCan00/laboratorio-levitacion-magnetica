/**
 * PhysicsPanel.js
 * Controlador del panel lateral "CENTRO DE ANÁLISIS FÍSICO".
 * Actualiza en tiempo real:
 * - Ecuación de Fuerza Gravitacional Fg = m × g con sustitución numérica viva.
 * - Ecuación del Modelo Magnético Aproximado de cada simulador.
 * - Diagrama vectorial SVG dinámico (Fg hacia abajo, Fmag hacia arriba, v horizontal).
 * - Diagnóstico de estabilidad (Teorema de Earnshaw, ventana giroscópica, rizado de bobinas).
 */

import { G_ACCEL } from '../physics/LevitronPhysics.js';

export class PhysicsPanel {
  constructor() {
    this.focusedSimulator = 'levitron'; // 'levitron' | 'maglev'

    // Referencias DOM del Centro de Análisis Físico
    this.elActiveTabTitle = document.getElementById('analysis-active-sim');
    this.elFgFormulaLive = document.getElementById('analysis-fg-live');
    this.elFmagFormulaLive = document.getElementById('analysis-fmag-live');
    this.elNetForceLive = document.getElementById('analysis-fnet-live');
    this.elAssumptionNote = document.getElementById('analysis-model-note');
    this.elDiagnosticBox = document.getElementById('analysis-diagnostic-text');

    // Elementos del diagrama vectorial SVG
    this.svgVecFgLine = document.getElementById('svg-vec-fg-line');
    this.svgVecFgLabel = document.getElementById('svg-vec-fg-label');
    this.svgVecFmagLine = document.getElementById('svg-vec-fmag-line');
    this.svgVecFmagLabel = document.getElementById('svg-vec-fmag-label');
    this.svgVecVelGroup = document.getElementById('svg-vec-vel-group');
    this.svgVecVelLine = document.getElementById('svg-vec-vel-line');
    this.svgVecVelLabel = document.getElementById('svg-vec-vel-label');
    this.svgBodyNode = document.getElementById('svg-vector-body');

    this.bindTabs();
  }

  bindTabs() {
    const tabs = document.querySelectorAll('[data-analysis-tab]');
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabs.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        this.focusedSimulator = btn.dataset.analysisTab;
      });
    });
  }

  setFocusedSimulator(simKey) {
    this.focusedSimulator = simKey;
    const tabs = document.querySelectorAll('[data-analysis-tab]');
    tabs.forEach((b) => {
      const isMatch = b.dataset.analysisTab === simKey;
      b.classList.toggle('active', isMatch);
      b.setAttribute('aria-selected', String(isMatch));
    });
  }

  update(levTelemetry, magTelemetry) {
    if (this.focusedSimulator === 'levitron') {
      this.renderLevitronAnalysis(levTelemetry);
    } else {
      this.renderMaglevAnalysis(magTelemetry);
    }
  }

  renderLevitronAnalysis(t) {
    if (this.elActiveTabTitle) {
      this.elActiveTabTitle.textContent = 'Simulador A: Levitron (Estabilización Giroscópica)';
    }

    // 1. Fuerza gravitacional Fg = m × g
    if (this.elFgFormulaLive) {
      this.elFgFormulaLive.innerHTML =
        `F<sub>g</sub> = ${t.massKg.toFixed(3)} kg × ${G_ACCEL} m/s² = <strong>${t.gravityForceN.toFixed(3)} N</strong>`;
    }

    // 2. Fuerza magnética estimada (modelo dipolo-anillo)
    if (this.elFmagFormulaLive) {
      this.elFmagFormulaLive.innerHTML =
        `F<sub>mag</sub>(B<sub>r</sub>=${t.magneticFieldTesla.toFixed(2)} T, R=${t.baseMagnetSize.toFixed(1)} cm, z=${t.heightCm.toFixed(1)} cm, θ=${t.tiltDeg}°) ≈ <strong>${t.magneticForceN.toFixed(3)} N</strong> ` +
        `<span class="formula-sub">[Material: ${t.magnetMaterial} · Ventana: ${t.rpmWindow[0]}–${t.rpmWindow[1]} RPM]</span>`;
    }

    // 3. Fuerza neta e indicador
    if (this.elNetForceLive) {
      const sign = t.netForceN >= 0 ? '+' : '';
      this.elNetForceLive.innerHTML =
        `ΣF<sub>z</sub> = F<sub>mag</sub> − F<sub>g</sub> = <strong>${sign}${t.netForceN.toFixed(3)} N</strong> · ω = <strong>${t.omegaRadS} rad/s</strong>`;
    }

    if (this.elAssumptionNote) {
      this.elAssumptionNote.innerHTML =
        `<strong>Modelo aproximado Dipolo-Anillo + Giroscopio:</strong> F<sub>mag</sub>(z,θ) = F<sub>0</sub>(R<sub>anillo</sub>, B<sub>r</sub>) · [1 + (z/R<sub>c</sub>)²]<sup>−2.2</sup> · cos(θ). ` +
        `Por el <em>Teorema de Earnshaw</em>, igualar F<sub>mag</sub> = F<sub>g</sub> no basta: sin momento angular L = I·ω en la ventana de ${t.rpmWindow[0]}–${t.rpmWindow[1]} RPM, el dipolo se voltea (θ → 90°) y cae.`;
    }

    if (this.elDiagnosticBox) {
      this.elDiagnosticBox.textContent = `[${t.status}] ${t.statusReason}`;
    }

    // 4. Actualizar diagrama vectorial SVG (centro en x=130, y=105)
    const cx = 130;
    const cy = 105;
    const maxPx = 74;

    const fgLen = Math.min(maxPx, Math.max(18, Math.sqrt(t.gravityForceN) * 62));
    const fmagLen =
      t.magneticForceN > 0.002
        ? Math.min(maxPx, Math.max(14, Math.sqrt(t.magneticForceN) * 62))
        : 0;

    // Fg hacia abajo (cx, cy -> cx, cy + fgLen)
    this.svgVecFgLine.setAttribute('x1', cx);
    this.svgVecFgLine.setAttribute('y1', cy);
    this.svgVecFgLine.setAttribute('x2', cx);
    this.svgVecFgLine.setAttribute('y2', cy + fgLen);
    this.svgVecFgLabel.setAttribute('x', cx + 10);
    this.svgVecFgLabel.setAttribute('y', cy + fgLen - 2);
    this.svgVecFgLabel.textContent = `Fg (${t.gravityForceN.toFixed(2)} N)`;

    // Fmag hacia arriba con inclinación θ
    const tiltRad = (t.tiltDeg * Math.PI) / 180;
    const tipX = cx + Math.sin(tiltRad) * fmagLen;
    const tipY = cy - Math.cos(tiltRad) * fmagLen;
    this.svgVecFmagLine.setAttribute('x1', cx);
    this.svgVecFmagLine.setAttribute('y1', cy);
    this.svgVecFmagLine.setAttribute('x2', tipX);
    this.svgVecFmagLine.setAttribute('y2', tipY);
    this.svgVecFmagLine.style.opacity = fmagLen > 2 ? '1' : '0';
    this.svgVecFmagLabel.setAttribute('x', tipX + 8);
    this.svgVecFmagLabel.setAttribute('y', Math.max(18, tipY + 4));
    this.svgVecFmagLabel.textContent = fmagLen > 2 ? `Fmag (${t.magneticForceN.toFixed(2)} N)` : 'Fmag (0 N)';

    // Vector de momento angular / giro ω
    const rpmLen = t.spinRpm > 0 ? 20 + (t.spinRpm / 3000) * 52 : 0;
    this.svgVecVelGroup.style.opacity = rpmLen > 0 ? '1' : '0.2';
    this.svgVecVelLine.setAttribute('x1', cx);
    this.svgVecVelLine.setAttribute('y1', cy);
    this.svgVecVelLine.setAttribute('x2', cx + rpmLen);
    this.svgVecVelLine.setAttribute('y2', cy);
    this.svgVecVelLabel.setAttribute('x', cx + rpmLen - 10);
    this.svgVecVelLabel.setAttribute('y', cy - 10);
    this.svgVecVelLabel.textContent = `ω = ${t.spinRpm} RPM`;

    if (this.svgBodyNode) {
      this.svgBodyNode.setAttribute('transform', `rotate(${t.tiltDeg} ${cx} ${cy})`);
    }
  }

  renderMaglevAnalysis(t) {
    if (this.elActiveTabTitle) {
      this.elActiveTabTitle.textContent = 'Simulador B: Tren Maglev (Suspensión + Propulsión LSM)';
    }

    const fgkN = t.gravityForceN / 1000;
    const femkN = t.electromagneticForceN / 1000;
    const fnetkN = t.netVerticalForceN / 1000;

    if (this.elFgFormulaLive) {
      this.elFgFormulaLive.innerHTML =
        `F<sub>g</sub> = ${t.trainMassKg.toLocaleString('es-CO')} kg × ${G_ACCEL} m/s² = <strong>${fgkN.toFixed(2)} kN</strong> (${Math.round(t.gravityForceN).toLocaleString('es-CO')} N)`;
    }

    if (this.elFmagFormulaLive) {
      this.elFmagFormulaLive.innerHTML =
        `F<sub>em</sub>(h=${t.actualHeightCm.toFixed(1)} cm, B=${t.magneticFieldTesla.toFixed(2)} T, I=${t.electricCurrentAmps} A, d=${t.coilSpacingCm} cm) ≈ <strong>${femkN.toFixed(2)} kN</strong>`;
    }

    if (this.elNetForceLive) {
      const sign = fnetkN >= 0 ? '+' : '';
      this.elNetForceLive.innerHTML =
        `ΣF<sub>z</sub> = F<sub>em</sub> − F<sub>g</sub> = <strong>${sign}${fnetkN.toFixed(2)} kN</strong> · Velocidad: <strong>${t.speedKmh.toFixed(0)} km/h (${t.speedMps} m/s)</strong>`;
    }

    if (this.elAssumptionNote) {
      this.elAssumptionNote.innerHTML =
        `<strong>Modelo EMS/LSM desacoplado:</strong> F<sub>em,máx</sub>(h) = F<sub>0</sub> · (B / B<sub>máx</sub>)<sup>1.1</sup> · (I / I<sub>máx</sub>)<sup>1.1</sup> · η(d<sub>bobina</sub>) / (1 + h/z<sub>0</sub>)<sup>1.75</sup>. ` +
        `La suspensión vertical es generada por el campo magnético B (en Teslas) y la corriente I (en Amperios), independientemente de la velocidad de propulsión horizontal.`;
    }

    if (this.elDiagnosticBox) {
      this.elDiagnosticBox.textContent = `[${t.status}] ${t.statusReason}`;
    }

    // Actualizar diagrama vectorial SVG
    const cx = 130;
    const cy = 105;
    const maxPx = 74;

    const fgLen = Math.min(maxPx, Math.max(20, Math.log10(fgkN + 1) * 36));
    const femLen =
      femkN > 0.05 ? Math.min(maxPx, Math.max(16, Math.log10(femkN + 1) * 36)) : 0;

    this.svgVecFgLine.setAttribute('x1', cx);
    this.svgVecFgLine.setAttribute('y1', cy);
    this.svgVecFgLine.setAttribute('x2', cx);
    this.svgVecFgLine.setAttribute('y2', cy + fgLen);
    this.svgVecFgLabel.setAttribute('x', cx + 10);
    this.svgVecFgLabel.setAttribute('y', cy + fgLen - 2);
    this.svgVecFgLabel.textContent = `Fg (${fgkN.toFixed(1)} kN)`;

    this.svgVecFmagLine.setAttribute('x1', cx);
    this.svgVecFmagLine.setAttribute('y1', cy);
    this.svgVecFmagLine.setAttribute('x2', cx);
    this.svgVecFmagLine.setAttribute('y2', cy - femLen);
    this.svgVecFmagLine.style.opacity = femLen > 2 ? '1' : '0';
    this.svgVecFmagLabel.setAttribute('x', cx + 10);
    this.svgVecFmagLabel.setAttribute('y', Math.max(18, cy - femLen + 4));
    this.svgVecFmagLabel.textContent = femLen > 2 ? `Fem (${femkN.toFixed(1)} kN)` : 'Fem (0 kN)';

    const vLen = t.speedKmh > 0.5 ? 20 + (t.speedKmh / 300) * 65 : 0;
    this.svgVecVelGroup.style.opacity = vLen > 0 ? '1' : '0.2';
    this.svgVecVelLine.setAttribute('x1', cx);
    this.svgVecVelLine.setAttribute('y1', cy);
    this.svgVecVelLine.setAttribute('x2', cx + vLen);
    this.svgVecVelLine.setAttribute('y2', cy);
    this.svgVecVelLabel.setAttribute('x', cx + Math.max(24, vLen - 15));
    this.svgVecVelLabel.setAttribute('y', cy - 10);
    this.svgVecVelLabel.textContent = `v = ${t.speedKmh.toFixed(0)} km/h`;

    if (this.svgBodyNode) {
      this.svgBodyNode.setAttribute('transform', `rotate(0 ${cx} ${cy})`);
    }
  }
}

