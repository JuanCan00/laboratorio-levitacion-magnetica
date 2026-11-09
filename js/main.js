/**
 * main.js
 * Orquestador principal del LABORATORIO VIRTUAL DE LEVITACIÓN MAGNÉTICA.
 * Todos los controles e indicadores operan con unidades reales del Sistema Internacional:
 * - Campo magnético en Teslas (T)
 * - Corriente eléctrica en Amperios (A)
 * - Dimensiones y distancias en centímetros (cm)
 * - Masas en gramos (g) y kilogramos (kg)
 * - Fuerzas en Newtons (N) y kiloNewtons (kN)
 */

import { LevitronPhysics } from './physics/LevitronPhysics.js';
import { MaglevPhysics } from './physics/MaglevPhysics.js';
import { LevitronScene } from './scenes/LevitronScene.js';
import { MaglevScene } from './scenes/MaglevScene.js';
import { PhysicsPanel } from './ui/PhysicsPanel.js';
import { MotionController } from './ui/MotionController.js';

/**
 * Configuraciones de los 3 Experimentos Preconfigurados en unidades físicas reales.
 */
const PRESET_EXPERIMENTS = {
  low: {
    title: 'Experimento 1: Campo Magnético Bajo (Ferrita / Baja Excitación)',
    levitron: {
      baseMagnetSize: 3.0,      // 3.0 cm de radio exterior
      magneticFieldTesla: 0.34, // 0.34 T (Imán de Ferrita Cerámica)
      massGrams: 55,            // 55 g
      initialDistanceCm: 4.0,   // 4.0 cm
      spinRpm: 1600             // 1600 RPM
    },
    maglev: {
      trainMassKg: 5200,        // 5200 kg
      magneticFieldTesla: 1.25, // 1.25 T
      desiredHeightCm: 15,      // 15 cm
      speedKmh: 120,            // 120 km/h
      electricCurrentAmps: 300, // 300 A
      coilSpacingCm: 45         // 45 cm
    }
  },
  medium: {
    title: 'Experimento 2: Campo Magnético Medio (Samario-Cobalto / Equilibrio Óptimo)',
    levitron: {
      baseMagnetSize: 5.0,      // 5.0 cm de radio exterior
      magneticFieldTesla: 0.98, // 0.98 T (Samario-Cobalto SmCo)
      massGrams: 28,            // 28 g
      initialDistanceCm: 5.5,   // 5.5 cm
      spinRpm: 1850             // 1850 RPM
    },
    maglev: {
      trainMassKg: 2800,        // 2800 kg
      magneticFieldTesla: 3.60, // 3.60 T
      desiredHeightCm: 12,      // 12 cm
      speedKmh: 180,            // 180 km/h
      electricCurrentAmps: 750, // 750 A
      coilSpacingCm: 30         // 30 cm
    }
  },
  high: {
    title: 'Experimento 3: Campo Magnético Alto (Neodimio N52 / Superconductor)',
    levitron: {
      baseMagnetSize: 9.0,      // 9.0 cm de radio exterior
      magneticFieldTesla: 1.44, // 1.44 T (Neodimio Nd₂Fe₁₄B N52)
      massGrams: 35,            // 35 g
      initialDistanceCm: 8.5,   // 8.5 cm
      spinRpm: 2150             // 2150 RPM
    },
    maglev: {
      trainMassKg: 6400,        // 6400 kg
      magneticFieldTesla: 4.80, // 4.80 T (Bobina Superconductora NbTi)
      desiredHeightCm: 24,      // 24 cm
      speedKmh: 265,            // 265 km/h
      electricCurrentAmps: 950, // 950 A
      coilSpacingCm: 25         // 25 cm
    }
  }
};

/**
 * Sincroniza las variables CSS de progreso de un <input type="range">
 * siguiendo las guías `slider` y `brand-consistent-forms` de modern-web-guidance.
 */
function syncRangeSliderAppearance(slider, formattedText = null) {
  if (!slider) return;
  const min = parseFloat(slider.min || '0');
  const max = parseFloat(slider.max || '100');
  const val = parseFloat(slider.value || '0');
  const pct = ((val - min) / Math.max(1e-6, max - min)) * 100;

  slider.style.setProperty('--attr-min', String(min));
  slider.style.setProperty('--attr-max', String(max));
  slider.style.setProperty('--control-value', String(val));
  slider.style.setProperty('--progress', `${pct.toFixed(1)}%`);

  if (formattedText) {
    slider.setAttribute('aria-valuetext', formattedText);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const levPhysics = new LevitronPhysics();
  const magPhysics = new MaglevPhysics();

  const levViewport = document.getElementById('levitron-viewport');
  const magViewport = document.getElementById('maglev-viewport');

  const levScene = new LevitronScene(levViewport);
  const magScene = new MaglevScene(magViewport);

  const physicsPanel = new PhysicsPanel();
  const motionCtrl = new MotionController();

  let lastLevStatus = '';
  let lastMagStatus = '';

  // ==========================================================================
  // 2. CONEXIÓN DE CONTROLES INTERACTIVOS — SIMULADOR A: LEVITRON
  // ==========================================================================
  const levInputs = {
    baseMagnetSize: document.getElementById('lev-size'),
    magneticFieldTesla: document.getElementById('lev-intensity'),
    massGrams: document.getElementById('lev-mass'),
    initialDistanceCm: document.getElementById('lev-distance'),
    spinRpm: document.getElementById('lev-rpm')
  };

  const levValueLabels = {
    baseMagnetSize: document.getElementById('val-lev-size'),
    magneticFieldTesla: document.getElementById('val-lev-intensity'),
    massGrams: document.getElementById('val-lev-mass'),
    initialDistanceCm: document.getElementById('val-lev-distance'),
    spinRpm: document.getElementById('val-lev-rpm')
  };

  function updateLevitronControlLabels() {
    const p = levPhysics.params;
    const matShort = LevitronPhysics.getMaterialByTesla(p.magneticFieldTesla).split(' (')[0];
    levValueLabels.baseMagnetSize.textContent = `R = ${p.baseMagnetSize.toFixed(1)} cm (Ø ${(p.baseMagnetSize * 2).toFixed(0)} cm)`;
    levValueLabels.magneticFieldTesla.textContent = `${p.magneticFieldTesla.toFixed(2)} T (${matShort})`;
    levValueLabels.massGrams.textContent = `${p.massGrams} g`;
    levValueLabels.initialDistanceCm.textContent = `${p.initialDistanceCm.toFixed(1)} cm`;
    levValueLabels.spinRpm.textContent = `${p.spinRpm} RPM`;

    syncRangeSliderAppearance(levInputs.baseMagnetSize, `Radio ${p.baseMagnetSize} centímetros`);
    syncRangeSliderAppearance(levInputs.magneticFieldTesla, `${p.magneticFieldTesla.toFixed(2)} Teslas`);
    syncRangeSliderAppearance(levInputs.massGrams, `${p.massGrams} gramos`);
    syncRangeSliderAppearance(levInputs.initialDistanceCm, `${p.initialDistanceCm} centímetros`);
    syncRangeSliderAppearance(levInputs.spinRpm, `${p.spinRpm} revoluciones por minuto`);
  }

  Object.entries(levInputs).forEach(([key, inputEl]) => {
    inputEl.addEventListener('input', () => {
      const val = parseFloat(inputEl.value);
      const isInitialDist = key === 'initialDistanceCm';
      levPhysics.setParams({ [key]: val }, isInitialDist);
      updateLevitronControlLabels();
      physicsPanel.setFocusedSimulator('levitron');
    });
  });

  // Botones de acción del Levitron
  const btnLevStart = document.getElementById('btn-lev-start');
  const btnLevPause = document.getElementById('btn-lev-pause');
  const btnLevReset = document.getElementById('btn-lev-reset');
  const btnLevField = document.getElementById('btn-lev-field');

  function updateLevButtonsUI() {
    btnLevStart.classList.toggle('is-active', levPhysics.isRunning);
    btnLevPause.classList.toggle('is-active', !levPhysics.isRunning);
    btnLevField.classList.toggle('is-active', levPhysics.showFieldLines);
    btnLevField.setAttribute('aria-pressed', String(levPhysics.showFieldLines));
  }

  btnLevStart.addEventListener('click', () => {
    levPhysics.isRunning = true;
    updateLevButtonsUI();
  });

  btnLevPause.addEventListener('click', () => {
    levPhysics.isRunning = false;
    updateLevButtonsUI();
  });

  btnLevReset.addEventListener('click', () => {
    levPhysics.reset();
    levPhysics.isRunning = true;
    levScene.controls.reset();
    levScene.controls.target.set(0, 2.0, 0);
    updateLevButtonsUI();
  });

  btnLevField.addEventListener('click', () => {
    levPhysics.showFieldLines = !levPhysics.showFieldLines;
    updateLevButtonsUI();
  });

  // ==========================================================================
  // 3. CONEXIÓN DE CONTROLES INTERACTIVOS — SIMULADOR B: TREN MAGLEV
  // ==========================================================================
  const magInputs = {
    trainMassKg: document.getElementById('mag-mass'),
    magneticFieldTesla: document.getElementById('mag-intensity'),
    desiredHeightCm: document.getElementById('mag-height'),
    speedKmh: document.getElementById('mag-speed'),
    electricCurrentAmps: document.getElementById('mag-current'),
    coilSpacingCm: document.getElementById('mag-spacing')
  };

  const magValueLabels = {
    trainMassKg: document.getElementById('val-mag-mass'),
    magneticFieldTesla: document.getElementById('val-mag-intensity'),
    desiredHeightCm: document.getElementById('val-mag-height'),
    speedKmh: document.getElementById('val-mag-speed'),
    electricCurrentAmps: document.getElementById('val-mag-current'),
    coilSpacingCm: document.getElementById('val-mag-spacing')
  };

  function updateMaglevControlLabels() {
    const p = magPhysics.params;
    magValueLabels.trainMassKg.textContent = `${p.trainMassKg.toLocaleString('es-CO')} kg`;
    magValueLabels.magneticFieldTesla.textContent = `${p.magneticFieldTesla.toFixed(2)} T`;
    magValueLabels.desiredHeightCm.textContent = `${p.desiredHeightCm} cm`;
    magValueLabels.speedKmh.textContent = `${p.speedKmh} km/h (${(p.speedKmh / 3.6).toFixed(1)} m/s)`;
    magValueLabels.electricCurrentAmps.textContent = `${p.electricCurrentAmps} A`;
    magValueLabels.coilSpacingCm.textContent = `${p.coilSpacingCm} cm`;

    syncRangeSliderAppearance(magInputs.trainMassKg, `${p.trainMassKg} kilogramos`);
    syncRangeSliderAppearance(magInputs.magneticFieldTesla, `${p.magneticFieldTesla.toFixed(2)} Teslas`);
    syncRangeSliderAppearance(magInputs.desiredHeightCm, `${p.desiredHeightCm} centímetros`);
    syncRangeSliderAppearance(magInputs.speedKmh, `${p.speedKmh} kilómetros por hora`);
    syncRangeSliderAppearance(magInputs.electricCurrentAmps, `${p.electricCurrentAmps} Amperios`);
    syncRangeSliderAppearance(magInputs.coilSpacingCm, `${p.coilSpacingCm} centímetros`);
  }

  Object.entries(magInputs).forEach(([key, inputEl]) => {
    inputEl.addEventListener('input', () => {
      const val = parseFloat(inputEl.value);
      magPhysics.setParams({ [key]: val });
      updateMaglevControlLabels();
      physicsPanel.setFocusedSimulator('maglev');
    });
  });

  // Botones de acción del Tren Maglev
  const btnMagStart = document.getElementById('btn-mag-start');
  const btnMagPause = document.getElementById('btn-mag-pause');
  const btnMagReset = document.getElementById('btn-mag-reset');
  const btnMagField = document.getElementById('btn-mag-field');

  function updateMagButtonsUI() {
    btnMagStart.classList.toggle('is-active', magPhysics.isRunning);
    btnMagPause.classList.toggle('is-active', !magPhysics.isRunning);
    btnMagField.classList.toggle('is-active', magPhysics.showFieldLines);
    btnMagField.setAttribute('aria-pressed', String(magPhysics.showFieldLines));
  }

  btnMagStart.addEventListener('click', () => {
    magPhysics.isRunning = true;
    updateMagButtonsUI();
  });

  btnMagPause.addEventListener('click', () => {
    magPhysics.isRunning = false;
    updateMagButtonsUI();
  });

  btnMagReset.addEventListener('click', () => {
    magPhysics.reset();
    magPhysics.isRunning = true;
    magScene.controls.reset();
    magScene.controls.target.set(0, 1.3, 0);
    updateMagButtonsUI();
  });

  btnMagField.addEventListener('click', () => {
    magPhysics.showFieldLines = !magPhysics.showFieldLines;
    updateMagButtonsUI();
  });

  // ==========================================================================
  // 4. EXPERIMENTOS PRECONFIGURADOS (1: Baja, 2: Media, 3: Alta)
  // ==========================================================================
  function applyPresetExperiment(presetKey, cardEl) {
    const preset = PRESET_EXPERIMENTS[presetKey];
    if (!preset) return;

    Object.entries(preset.levitron).forEach(([k, v]) => {
      if (levInputs[k]) levInputs[k].value = String(v);
    });
    levPhysics.setParams(preset.levitron, true);
    levPhysics.reset();
    levPhysics.isRunning = true;
    updateLevitronControlLabels();
    updateLevButtonsUI();

    Object.entries(preset.maglev).forEach(([k, v]) => {
      if (magInputs[k]) magInputs[k].value = String(v);
    });
    magPhysics.setParams(preset.maglev);
    magPhysics.reset();
    magPhysics.isRunning = true;
    updateMaglevControlLabels();
    updateMagButtonsUI();

    document.querySelectorAll('.preset-card').forEach((c) => {
      c.classList.toggle('active', c === cardEl);
    });

    motionCtrl.animatePresetActivation(cardEl);
  }

  document.querySelectorAll('.preset-card[data-preset]').forEach((cardEl) => {
    cardEl.addEventListener('click', () => {
      applyPresetExperiment(cardEl.dataset.preset, cardEl);
    });
  });

  // ==========================================================================
  // 5. CONMUTADOR DE VISTA DE SIMULADORES (Dual / Levitron / Maglev)
  // ==========================================================================
  const modLevitron = document.getElementById('module-levitron');
  const modMaglev = document.getElementById('module-maglev');

  document.querySelectorAll('[data-view-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-view-mode]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.viewMode;
      modLevitron.hidden = mode === 'maglev';
      modMaglev.hidden = mode === 'levitron';

      if (mode === 'levitron') physicsPanel.setFocusedSimulator('levitron');
      if (mode === 'maglev') physicsPanel.setFocusedSimulator('maglev');

      motionCtrl.transitionSimulatorLayout(mode, () => {
        levScene.onResize();
        magScene.onResize();
      });
    });
  });

  // ==========================================================================
  // 6. ACTUALIZACIÓN DE LECTURAS EN TIEMPO REAL EN EL DOM
  // ==========================================================================
  const levDomReadouts = {
    mass: document.getElementById('readout-lev-mass'),
    intensity: document.getElementById('readout-lev-intensity'),
    distance: document.getElementById('readout-lev-distance'),
    rpm: document.getElementById('readout-lev-rpm'),
    fg: document.getElementById('readout-lev-fg'),
    fmag: document.getElementById('readout-lev-fmag'),
    height: document.getElementById('readout-lev-height'),
    statusBadge: document.getElementById('badge-lev-status'),
    statusReason: document.getElementById('reason-lev-status')
  };

  const magDomReadouts = {
    mass: document.getElementById('readout-mag-mass'),
    speed: document.getElementById('readout-mag-speed'),
    height: document.getElementById('readout-mag-height'),
    intensity: document.getElementById('readout-mag-intensity'),
    current: document.getElementById('readout-mag-current'),
    fg: document.getElementById('readout-mag-fg'),
    fem: document.getElementById('readout-mag-fem'),
    statusBadge: document.getElementById('badge-mag-status'),
    statusReason: document.getElementById('reason-mag-status')
  };

  function applyStatusClass(badgeEl, statusText) {
    badgeEl.className = 'status-pill';
    if (statusText === 'ESTABLE') badgeEl.classList.add('status-stable');
    else if (statusText === 'INESTABLE' || statusText === 'TRANSITORIO') badgeEl.classList.add('status-unstable');
    else if (statusText === 'FUERZA INSUFICIENTE') badgeEl.classList.add('status-insufficient');
    else badgeEl.classList.add('status-disabled');
  }

  function renderTelemetryToDOM(levT, magT) {
    // Lecturas Levitron en unidades reales
    levDomReadouts.mass.textContent = `${levT.massGrams} g (${levT.massKg.toFixed(3)} kg)`;
    levDomReadouts.intensity.textContent = `${levT.magneticFieldTesla.toFixed(2)} T (${levT.magnetMaterial.split(' (')[0]})`;
    levDomReadouts.distance.textContent = `${levT.initialDistanceCm.toFixed(1)} cm`;
    levDomReadouts.rpm.textContent = `${levT.spinRpm} RPM (${levT.omegaRadS} rad/s)`;
    levDomReadouts.fg.textContent = `${levT.gravityForceN.toFixed(3)} N`;
    levDomReadouts.fmag.textContent = `${levT.magneticForceN.toFixed(3)} N`;
    levDomReadouts.height.textContent = `${levT.heightCm.toFixed(2)} cm`;
    levDomReadouts.statusBadge.textContent = levT.status;
    levDomReadouts.statusReason.textContent = levT.statusReason;
    applyStatusClass(levDomReadouts.statusBadge, levT.status);

    if (levT.status !== lastLevStatus) {
      lastLevStatus = levT.status;
      motionCtrl.pulseStatusBadge(levDomReadouts.statusBadge);
    }

    // Lecturas Tren Maglev en unidades reales
    const fgkN = magT.gravityForceN / 1000;
    const femkN = magT.electromagneticForceN / 1000;
    magDomReadouts.mass.textContent = `${magT.trainMassKg.toLocaleString('es-CO')} kg`;
    magDomReadouts.speed.textContent = `${magT.speedKmh.toFixed(1)} km/h (${magT.speedMps} m/s)`;
    magDomReadouts.height.textContent = `${magT.actualHeightCm.toFixed(2)} cm (Obj: ${magT.desiredHeightCm} cm)`;
    magDomReadouts.intensity.textContent = `${magT.magneticFieldTesla.toFixed(2)} T`;
    magDomReadouts.current.textContent = `${magT.electricCurrentAmps} A`;
    magDomReadouts.fg.textContent = `${fgkN.toFixed(2)} kN (${Math.round(magT.gravityForceN).toLocaleString('es-CO')} N)`;
    magDomReadouts.fem.textContent = `${femkN.toFixed(2)} kN (${Math.round(magT.electromagneticForceN).toLocaleString('es-CO')} N)`;
    magDomReadouts.statusBadge.textContent = magT.status;
    magDomReadouts.statusReason.textContent = magT.statusReason;
    applyStatusClass(magDomReadouts.statusBadge, magT.status);

    if (magT.status !== lastMagStatus) {
      lastMagStatus = magT.status;
      motionCtrl.pulseStatusBadge(magDomReadouts.statusBadge);
    }
  }

  // ==========================================================================
  // 7. INICIALIZACIÓN Y BUCLE DE SIMULACIÓN EN TIEMPO REAL
  // ==========================================================================
  updateLevitronControlLabels();
  updateMaglevControlLabels();
  updateLevButtonsUI();
  updateMagButtonsUI();
  motionCtrl.playInitialEntrance();

  let lastTime = performance.now();

  function animateLoop(now) {
    requestAnimationFrame(animateLoop);

    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const levTelemetry = levPhysics.step(dt);
    const magTelemetry = magPhysics.step(dt);

    if (!modLevitron.hidden) {
      levScene.updateFromPhysics(levTelemetry, levPhysics, dt);
    }
    if (!modMaglev.hidden) {
      magScene.updateFromPhysics(magTelemetry, magPhysics, dt);
    }

    renderTelemetryToDOM(levTelemetry, magTelemetry);
    physicsPanel.update(levTelemetry, magTelemetry);
  }

  requestAnimationFrame(animateLoop);
});
