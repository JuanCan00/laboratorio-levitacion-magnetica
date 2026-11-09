/**
 * MaglevPhysics.js
 * Motor de simulación física educativa para el Tren de Levitación Magnética (Maglev)
 * empleando unidades físicas reales del Sistema Internacional:
 * - Masa del tren: M en kg (100 a 10000 kg)
 * - Campo magnético de bogie (B): en Teslas (0.0 a 5.0 T)
 * - Altura de levitación (entrehierro h): en centímetros (1 a 50 cm)
 * - Velocidad longitudinal (v): en km/h (0 a 300 km/h) y m/s
 * - Corriente eléctrica en bobinas de vía (I): en Amperios (0 a 1000 A)
 * - Separación entre electroimanes (d_coil): en centímetros (10 a 100 cm)
 */

import { G_ACCEL } from './LevitronPhysics.js';

export const MAX_MAGLEV_TESLA = 5.0;   // 5.0 T (Imán superconductor NbTi / YBCO)
export const MAX_MAGLEV_AMPS = 1000;   // 1000 A (Corriente de excitación en bobinas de vía)

export class MaglevPhysics {
  constructor() {
    this.params = {
      trainMassKg: 2800,         // 100 a 10000 kg
      magneticFieldTesla: 3.75,  // 0.0 a 5.0 T
      desiredHeightCm: 12,       // 1 a 50 cm
      speedKmh: 160,             // 0 a 300 km/h
      electricCurrentAmps: 750,  // 0 a 1000 A
      coilSpacingCm: 30          // 10 a 100 cm
    };

    this.isRunning = true;
    this.showFieldLines = true;
    this.time = 0;

    // Variables dinámicas de estado
    this.actualHeightCm = 12;
    this.verticalVelocityCmPs = 0;
    this.currentSpeedKmh = 160;
    this.trackPositionMeters = 0;
    this.pitchRad = 0;

    this.telemetry = {};
    this.recalculateTelemetry();
  }

  setParams(newParams) {
    Object.assign(this.params, newParams);
    if (newParams.speedKmh !== undefined && this.actualHeightCm > 0.35) {
      this.currentSpeedKmh = this.params.speedKmh;
    }
    this.recalculateTelemetry();
  }

  reset() {
    this.time = 0;
    this.verticalVelocityCmPs = 0;
    this.pitchRad = 0;
    const eqH = this.computeAchievableEquilibriumHeightCm();
    this.actualHeightCm = eqH;
    this.currentSpeedKmh = eqH > 0.3 ? this.params.speedKmh : 0;
    this.recalculateTelemetry();
  }

  getCoilDensityEfficiency() {
    const s = this.params.coilSpacingCm;
    return 1.08 / (1 + Math.pow(s / 95, 1.35));
  }

  /**
   * Fuerza electromagnética máxima disponible a nivel de vía (z -> 0) en Newtons
   * calculada a partir del campo B (Teslas) y la corriente I (Amperios).
   */
  getMaxSurfaceForceN() {
    const bFactor = this.params.magneticFieldTesla / MAX_MAGLEV_TESLA;
    const iFactor = this.params.electricCurrentAmps / MAX_MAGLEV_AMPS;
    if (bFactor <= 0 || iFactor <= 0) return 0;

    const density = this.getCoilDensityEfficiency();
    return 250000 * Math.pow(bFactor, 1.1) * Math.pow(iFactor, 1.1) * density;
  }

  computeAvailableCeilingForceAt(zCm) {
    const fSurface = this.getMaxSurfaceForceN();
    if (fSurface <= 0) return 0;
    const zChar = 16.0;
    const safeZ = Math.max(0, zCm);
    return fSurface / Math.pow(1 + safeZ / zChar, 1.75);
  }

  computeAchievableEquilibriumHeightCm() {
    const fg = this.params.trainMassKg * G_ACCEL;
    const fSurface = this.getMaxSurfaceForceN();
    if (fSurface <= fg || fg <= 0) return 0;

    const zChar = 16.0;
    const maxPhysicalHeight = zChar * (Math.pow(fSurface / fg, 1 / 1.75) - 1);
    return Math.max(0, Math.min(this.params.desiredHeightCm, maxPhysicalHeight));
  }

  evaluateSystemState(fg, fCeilingAtZero, maxPhysicalHeight) {
    if (this.params.magneticFieldTesla <= 0 || this.params.electricCurrentAmps <= 0) {
      return {
        status: 'SISTEMA DESACTIVADO',
        reason: 'Corriente eléctrica (0 A) o campo magnético (0.0 T): bobinas desenergizadas.'
      };
    }

    if (fCeilingAtZero < fg * 1.03 || maxPhysicalHeight < 0.8) {
      return {
        status: 'FUERZA INSUFICIENTE',
        reason: `Capacidad máxima (${(fCeilingAtZero / 1000).toFixed(1)} kN) insuficiente para sostener el peso Fg (${(fg / 1000).toFixed(1)} kN).`
      };
    }

    if (maxPhysicalHeight < this.params.desiredHeightCm * 0.72) {
      return {
        status: 'FUERZA INSUFICIENTE',
        reason: `Potencia (${this.params.magneticFieldTesla.toFixed(1)} T, ${this.params.electricCurrentAmps} A) insuficiente para alcanzar ${this.params.desiredHeightCm} cm (techo: ${maxPhysicalHeight.toFixed(1)} cm).`
      };
    }

    const spacingRatio = this.params.coilSpacingCm / Math.max(4, this.actualHeightCm);
    const forceMargin = fCeilingAtZero / fg;
    if (
      this.params.coilSpacingCm >= 75 ||
      (spacingRatio > 5.5 && this.params.coilSpacingCm >= 55) ||
      forceMargin < 1.18
    ) {
      return {
        status: 'INESTABLE',
        reason: `Oscilación por rizado magnético (separación de bobinas ${this.params.coilSpacingCm} cm o margen de reserva crítico).`
      };
    }

    return {
      status: 'ESTABLE',
      reason: `Suspensión activa regulada en ${this.actualHeightCm.toFixed(1)} cm (${this.params.magneticFieldTesla.toFixed(2)} T, ${this.params.electricCurrentAmps} A).`
    };
  }

  recalculateTelemetry(instantFem = null) {
    const fg = this.params.trainMassKg * G_ACCEL;
    const fSurface = this.getMaxSurfaceForceN();
    const zChar = 16.0;
    const maxPhysicalHeight =
      fSurface > fg ? zChar * (Math.pow(fSurface / fg, 1 / 1.75) - 1) : 0;

    const fem =
      instantFem !== null
        ? instantFem
        : this.actualHeightCm > 0.05
        ? Math.min(this.computeAvailableCeilingForceAt(this.actualHeightCm), fg)
        : this.computeAvailableCeilingForceAt(0);

    const { status, reason } = this.evaluateSystemState(fg, fSurface, maxPhysicalHeight);
    const speedMps = this.currentSpeedKmh / 3.6;

    this.telemetry = {
      trainMassKg: this.params.trainMassKg,
      speedKmh: Number(this.currentSpeedKmh.toFixed(1)),
      speedMps: Number(speedMps.toFixed(1)),
      targetSpeedKmh: this.params.speedKmh,
      actualHeightCm: Number(this.actualHeightCm.toFixed(2)),
      desiredHeightCm: this.params.desiredHeightCm,
      maxAchievableHeightCm: Number(Math.max(0, maxPhysicalHeight).toFixed(1)),
      magneticFieldTesla: this.params.magneticFieldTesla,
      magneticIntensityNorm: (this.params.magneticFieldTesla / MAX_MAGLEV_TESLA) * 100,
      electricCurrentAmps: this.params.electricCurrentAmps,
      electricCurrentNorm: (this.params.electricCurrentAmps / MAX_MAGLEV_AMPS) * 100,
      coilSpacingCm: this.params.coilSpacingCm,
      gravityForceN: fg,
      electromagneticForceN: fem,
      netVerticalForceN: fem - fg,
      status,
      statusReason: reason
    };
  }

  step(dt) {
    const clampedDt = Math.min(dt, 0.033);
    if (!this.isRunning) {
      this.recalculateTelemetry();
      return this.telemetry;
    }

    this.time += clampedDt;
    const massKg = this.params.trainMassKg;
    const fg = massKg * G_ACCEL;
    const fSurface = this.getMaxSurfaceForceN();
    const zChar = 16.0;
    const maxPhysicalHeight =
      fSurface > fg ? zChar * (Math.pow(fSurface / fg, 1 / 1.75) - 1) : 0;

    const targetEquilibriumCm = Math.max(
      0,
      Math.min(this.params.desiredHeightCm, maxPhysicalHeight)
    );

    const spacingMeters = this.params.coilSpacingCm / 100;
    const spatialPhase = (this.trackPositionMeters / Math.max(0.1, spacingMeters)) * Math.PI * 2;
    const spacingInstability = Math.pow(this.params.coilSpacingCm / 100, 1.8);

    const isUnstableConfig =
      this.params.coilSpacingCm >= 75 ||
      (fSurface > fg && fSurface / fg < 1.18);

    const rippleCm =
      targetEquilibriumCm > 0.2
        ? spacingInstability * 1.35 * Math.sin(spatialPhase + this.time * 5.5) +
          (isUnstableConfig ? 0.95 * Math.sin(this.time * 8.2) : 0.08 * Math.sin(this.time * 3.0))
        : 0;

    const dynamicTargetHeightCm = Math.max(0, targetEquilibriumCm + rippleCm);

    const heightErrorCm = dynamicTargetHeightCm - this.actualHeightCm;
    const stiffness = isUnstableConfig ? 24.0 : 38.0;
    const damping = isUnstableConfig ? 4.2 : 9.5;

    const verticalAccelCmPs2 = stiffness * heightErrorCm - damping * this.verticalVelocityCmPs;
    this.verticalVelocityCmPs += verticalAccelCmPs2 * clampedDt;
    this.actualHeightCm += this.verticalVelocityCmPs * clampedDt;

    if (this.actualHeightCm <= 0) {
      this.actualHeightCm = 0;
      if (this.verticalVelocityCmPs < 0) this.verticalVelocityCmPs = 0;
    } else if (this.actualHeightCm > 55) {
      this.actualHeightCm = 55;
      this.verticalVelocityCmPs = 0;
    }

    let instantFem = 0;
    if (fSurface <= 0) {
      instantFem = 0;
    } else if (this.actualHeightCm <= 0.05 && fSurface < fg) {
      instantFem = fSurface;
    } else {
      const dynamicForceN = fg + massKg * (verticalAccelCmPs2 / 100);
      const ceilingAtCurrentZ = this.computeAvailableCeilingForceAt(this.actualHeightCm);
      instantFem = Math.max(0, Math.min(ceilingAtCurrentZ * 1.05, dynamicForceN));
    }

    const canPropulse = this.actualHeightCm > 0.35;
    const effectiveTargetSpeedKmh = canPropulse ? this.params.speedKmh : 0;
    this.currentSpeedKmh += (effectiveTargetSpeedKmh - this.currentSpeedKmh) * 4.0 * clampedDt;
    if (this.currentSpeedKmh < 0.1) this.currentSpeedKmh = 0;

    const speedMps = this.currentSpeedKmh / 3.6;
    this.trackPositionMeters += speedMps * clampedDt;

    this.pitchRad =
      this.actualHeightCm > 0.3
        ? (isUnstableConfig ? 0.028 : 0.005) * Math.sin(this.time * 6.5)
        : 0;

    this.recalculateTelemetry(instantFem);
    return this.telemetry;
  }
}
