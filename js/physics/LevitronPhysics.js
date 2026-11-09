/**
 * LevitronPhysics.js
 * Motor de simulación física educativa para el sistema Levitron con unidades reales del SI:
 * - Radio del imán anular inferior: R_anillo en cm (1.0 a 10.0 cm)
 * - Intensidad de campo magnético (Remanencia Br): en Teslas (0.00 a 1.50 T)
 * - Masa del trompo suspendido: m en gramos (1 a 100 g) / kilogramos (kg)
 * - Distancia inicial: z0 en centímetros (1.0 a 20.0 cm)
 * - Velocidad de rotación: ω en RPM (0 a 3000 RPM) y rad/s
 */

export const G_ACCEL = 9.81; // m/s²
export const MAX_LEVITRON_TESLA = 1.50; // T (Neodimio N52)

export class LevitronPhysics {
  constructor() {
    this.params = {
      baseMagnetSize: 5.0,     // Radio exterior del imán anular: 1.0 a 10.0 cm
      magneticFieldTesla: 0.98, // Inducción remanente Br: 0.00 a 1.50 T
      massGrams: 28,           // 1 a 100 g
      initialDistanceCm: 5.5,  // 1 a 20 cm
      spinRpm: 1850            // 0 a 3000 RPM
    };

    this.isRunning = true;
    this.showFieldLines = true;
    this.time = 0;

    // Variables dinámicas de estado
    this.heightCm = this.params.initialDistanceCm;
    this.velocityCmPerSec = 0;
    this.tiltRad = 0.03;        // Ángulo de nutación / inclinación (rad)
    this.tiltVel = 0;
    this.spinAngle = 0;         // Rotación propia (rad)
    this.precessionAngle = 0;   // Precesión giroscópica (rad)
    this.radialOffsetCm = 0;    // Desplazamiento lateral por inestabilidad

    this.telemetry = {};
    this.recalculateStaticTelemetry();
  }

  /**
   * Identifica el material ferromagnético real según la remanencia magnética Br (en Teslas).
   */
  static getMaterialByTesla(tesla) {
    if (tesla <= 0.01) return 'Desmagnetizado (0 T)';
    if (tesla < 0.45) return 'Ferrita Cerámica (SrFe₁₂O₁₉)';
    if (tesla < 0.85) return 'Alnico (Al-Ni-Co)';
    if (tesla < 1.15) return 'Samario-Cobalto (SmCo)';
    return 'Neodimio (Nd₂Fe₁₄B)';
  }

  setParams(newParams, resetPositionIfInitialChanged = false) {
    const prevInitial = this.params.initialDistanceCm;
    Object.assign(this.params, newParams);

    if (
      resetPositionIfInitialChanged &&
      newParams.initialDistanceCm !== undefined &&
      newParams.initialDistanceCm !== prevInitial
    ) {
      this.heightCm = this.params.initialDistanceCm;
      this.velocityCmPerSec = 0;
      this.tiltRad = 0.03;
    }

    this.recalculateStaticTelemetry();
  }

  reset() {
    this.time = 0;
    this.heightCm = this.params.initialDistanceCm;
    this.velocityCmPerSec = 0;
    this.tiltRad = 0.035;
    this.tiltVel = 0;
    this.radialOffsetCm = 0;
    this.recalculateStaticTelemetry();
  }

  /**
   * Longitud característica R_char (en cm) del pozo anular según el radio del anillo (1..10 cm)
   */
  getCharacteristicRadiusCm() {
    return 2.2 + this.params.baseMagnetSize * 0.58;
  }

  /**
   * Fuerza magnética máxima (en Newtons) en función del radio del anillo (cm) y el campo Br (Teslas).
   */
  getPeakMagneticForceN() {
    const sizeFactor = Math.pow(this.params.baseMagnetSize / 5.0, 1.25);
    const normalizedTesla = this.params.magneticFieldTesla / MAX_LEVITRON_TESLA;
    return 2.55 * sizeFactor * normalizedTesla;
  }

  /**
   * Fuerza magnética repulsiva axial (en Newtons) a una altura zCm y ángulo tiltRad.
   */
  computeMagneticForceAt(zCm, tiltRad = 0) {
    if (this.params.magneticFieldTesla <= 0) return 0;
    const rChar = this.getCharacteristicRadiusCm();
    const safeZ = Math.max(0.4, zCm);
    const normalizedZ = safeZ / rChar;
    const spatialDecay = 1 / Math.pow(1 + normalizedZ * normalizedZ, 2.2);
    const orientationFactor = Math.cos(tiltRad);
    return Math.max(0, this.getPeakMagneticForceN() * spatialDecay * orientationFactor);
  }

  /**
   * Ventana de RPM necesaria para la estabilización giroscópica según Br (T) y masa (g).
   */
  getGyroscopicRpmWindow() {
    const normB = (this.params.magneticFieldTesla / MAX_LEVITRON_TESLA) * 100;
    const mass = this.params.massGrams;
    const minRpm = Math.round(950 + normB * 3.8 + Math.max(0, (30 - mass) * 4));
    const maxRpm = Math.round(2550 + this.params.baseMagnetSize * 35);
    return [minRpm, maxRpm];
  }

  getTrapHeightWindowCm() {
    const rChar = this.getCharacteristicRadiusCm();
    return [
      Number((rChar * 0.35).toFixed(1)),
      Number((rChar * 1.65).toFixed(1))
    ];
  }

  computeTheoreticalEquilibriumCm() {
    const fg = (this.params.massGrams / 1000) * G_ACCEL;
    const fPeak = this.getPeakMagneticForceN();
    if (fPeak <= fg || fg <= 0) return 0;
    const rChar = this.getCharacteristicRadiusCm();
    const ratio = fPeak / fg;
    const zEq = rChar * Math.sqrt(Math.pow(ratio, 1 / 2.2) - 1);
    return Number(Math.min(25, Math.max(0.5, zEq)).toFixed(2));
  }

  recalculateStaticTelemetry() {
    const massKg = this.params.massGrams / 1000;
    const fg = massKg * G_ACCEL;
    const fMag = this.computeMagneticForceAt(this.heightCm, this.tiltRad);
    const fNet = fMag - fg;
    const rpmWindow = this.getGyroscopicRpmWindow();
    const trapWindow = this.getTrapHeightWindowCm();
    const eqHeight = this.computeTheoreticalEquilibriumCm();
    const omegaRadS = (this.params.spinRpm * 2 * Math.PI) / 60;

    const { status, reason } = this.evaluateStabilityState(fg, fMag, eqHeight, rpmWindow, trapWindow);

    this.telemetry = {
      massGrams: this.params.massGrams,
      massKg,
      magneticFieldTesla: this.params.magneticFieldTesla,
      magneticIntensityNorm: (this.params.magneticFieldTesla / MAX_LEVITRON_TESLA) * 100,
      magnetMaterial: LevitronPhysics.getMaterialByTesla(this.params.magneticFieldTesla),
      baseMagnetSize: this.params.baseMagnetSize,
      initialDistanceCm: this.params.initialDistanceCm,
      gravityForceN: fg,
      magneticForceN: fMag,
      netForceN: fNet,
      heightCm: this.heightCm,
      equilibriumHeightCm: eqHeight,
      spinRpm: this.params.spinRpm,
      omegaRadS: Number(omegaRadS.toFixed(1)),
      tiltDeg: Number(((this.tiltRad * 180) / Math.PI).toFixed(1)),
      rpmWindow,
      trapHeightWindow: trapWindow,
      status,
      statusReason: reason
    };
  }

  evaluateStabilityState(fg, fMag, eqHeight, rpmWindow, trapWindow) {
    if (this.params.magneticFieldTesla <= 0) {
      return {
        status: 'SISTEMA DESACTIVADO',
        reason: 'Campo magnético Br = 0.00 T: ausencia de campo magnético repulsivo.'
      };
    }

    const fPeak = this.getPeakMagneticForceN();
    if (fPeak < fg * 1.02) {
      return {
        status: 'FUERZA INSUFICIENTE',
        reason: `La fuerza magnética máxima (${fPeak.toFixed(2)} N con ${this.params.magneticFieldTesla.toFixed(2)} T) es menor que el peso Fg (${fg.toFixed(2)} N).`
      };
    }

    const rpm = this.params.spinRpm;
    const [minRpm, maxRpm] = rpmWindow;

    if (rpm < 200) {
      return {
        status: 'INESTABLE',
        reason: 'Teorema de Earnshaw: sin rotación giroscópica el dipolo sufre volteo magnético y cae.'
      };
    }

    if (rpm < minRpm) {
      return {
        status: 'INESTABLE',
        reason: `Rotación insuficiente (${rpm} RPM < ${minRpm} RPM): precesión divergente por torque de volteo.`
      };
    }

    if (rpm > maxRpm) {
      return {
        status: 'INESTABLE',
        reason: `Exceso giroscópico (${rpm} RPM > ${maxRpm} RPM): rigidez axial impide seguir las líneas del pozo.`
      };
    }

    const [minZ, maxZ] = trapWindow;
    if (eqHeight < minZ || eqHeight > maxZ) {
      return {
        status: 'INESTABLE',
        reason: `Altura de equilibrio (${eqHeight.toFixed(1)} cm) fuera del pozo de estabilidad radial (${minZ}–${maxZ} cm).`
      };
    }

    if (Math.abs(this.heightCm - eqHeight) > 3.2) {
      return {
        status: 'TRANSITORIO',
        reason: `Oscilando hacia el punto de equilibrio magnético (${eqHeight.toFixed(1)} cm).`
      };
    }

    return {
      status: 'ESTABLE',
      reason: `Equilibrio dinámico (Fg ≈ Fmag = ${fg.toFixed(2)} N) con imán anular de ${this.params.magneticFieldTesla.toFixed(2)} T.`
    };
  }

  step(dt) {
    const clampedDt = Math.min(dt, 0.033);
    if (!this.isRunning) {
      this.recalculateStaticTelemetry();
      return this.telemetry;
    }

    this.time += clampedDt;
    const subSteps = 4;
    const hDt = clampedDt / subSteps;

    const massKg = this.params.massGrams / 1000;
    const fg = massKg * G_ACCEL;
    const rpm = this.params.spinRpm;
    const [minRpm, maxRpm] = this.getGyroscopicRpmWindow();
    const [minTrapZ, maxTrapZ] = this.getTrapHeightWindowCm();
    const eqHeight = this.computeTheoreticalEquilibriumCm();

    const gyroStable = rpm >= minRpm && rpm <= maxRpm && this.params.magneticFieldTesla > 0;
    const inRadialTrap = eqHeight >= minTrapZ && eqHeight <= maxTrapZ;

    for (let i = 0; i < subSteps; i++) {
      if (this.params.magneticFieldTesla <= 0) {
        this.tiltRad += (0.45 - this.tiltRad) * 5 * hDt;
      } else if (rpm < 200) {
        this.tiltRad += (1.38 - this.tiltRad) * 4.2 * hDt;
      } else if (!gyroStable) {
        const instabilityFactor = rpm < minRpm ? (minRpm - rpm) / minRpm : (rpm - maxRpm) / 600;
        const targetTilt = Math.min(1.25, 0.35 + instabilityFactor * 0.85);
        const nutation = Math.sin(this.time * 9.5) * 0.12;
        this.tiltRad += (targetTilt + nutation - this.tiltRad) * 3.2 * hDt;
      } else {
        const baseNutation = 0.035 + (1800 / Math.max(1000, rpm)) * 0.025;
        const targetTilt = baseNutation + Math.sin(this.time * 6.0) * 0.012;
        this.tiltRad += (targetTilt - this.tiltRad) * 4.5 * hDt;
      }

      const fMag = this.computeMagneticForceAt(this.heightCm, this.tiltRad);
      const trapPenalty = !inRadialTrap && gyroStable ? 0.82 : 1.0;
      const effectiveNetForceN = fMag * trapPenalty - fg;

      const accelMps2 = effectiveNetForceN / massKg;
      const accelCmPs2 = accelMps2 * 100;

      const damping = 3.6;
      this.velocityCmPerSec += (accelCmPs2 - damping * this.velocityCmPerSec) * hDt;
      this.heightCm += this.velocityCmPerSec * hDt;

      if (this.heightCm <= 0.6) {
        this.heightCm = 0.6;
        if (this.velocityCmPerSec < 0) {
          this.velocityCmPerSec = -this.velocityCmPerSec * 0.25;
        }
      } else if (this.heightCm >= 22.0) {
        this.heightCm = 22.0;
        if (this.velocityCmPerSec > 0) {
          this.velocityCmPerSec = -this.velocityCmPerSec * 0.3;
        }
      }
    }

    const omegaRadPerSec = (rpm * 2 * Math.PI) / 60;
    this.spinAngle = (this.spinAngle + Math.min(omegaRadPerSec, 65) * clampedDt) % (Math.PI * 2);
    const normB = (this.params.magneticFieldTesla / MAX_LEVITRON_TESLA) * 100;
    const precessionRate = rpm > 100 ? (18000 / Math.max(400, rpm)) * (normB / 60) : 0;
    this.precessionAngle = (this.precessionAngle + precessionRate * clampedDt) % (Math.PI * 2);

    if (!gyroStable || !inRadialTrap) {
      const targetRadial = Math.min(1.8, this.tiltRad * 1.4);
      this.radialOffsetCm += (targetRadial - this.radialOffsetCm) * 3 * clampedDt;
    } else {
      this.radialOffsetCm += (0.08 * Math.sin(this.time * 2.5) - this.radialOffsetCm) * 4 * clampedDt;
    }

    this.recalculateStaticTelemetry();
    return this.telemetry;
  }
}
