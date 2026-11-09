/**
 * MaglevScene.js
 * Escenario tridimensional interactivo para el Simulador B: TREN MAGLEV.
 * Incluye:
 * - Vía de levitación magnética (guideway) con desplazamiento continuo según velocidad (0..300 km/h).
 * - Electroimanes distribuidos en la vía con polos N/S cuya separación responde en tiempo real (10..100 cm).
 * - Tren futurista con módulos magnéticos visibles en su parte inferior (bogie).
 * - Líneas de campo magnético 3D en el entrehierro + marcadores de dirección de flujo.
 * - Vectores 3D dinámicos: Gravedad (Fg), Fuerza Electromagnética (Fem) y Velocidad (v).
 * - Indicador láser 3D de altura de levitación actual vs. deseada.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTextSprite, updateTextSprite, DynamicVector3D } from './SceneUtils.js';

export class MaglevScene {
  constructor(containerEl) {
    this.container = containerEl;
    this.width = containerEl.clientWidth || 600;
    this.height = containerEl.clientHeight || 440;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a14);
    this.scene.fog = new THREE.FogExp2(0x060a14, 0.025);

    this.camera = new THREE.PerspectiveCamera(42, this.width / this.height, 0.1, 120);
    this.camera.position.set(6.5, 3.6, 8.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    containerEl.innerHTML = '';
    containerEl.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 1.3, 0);
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 20.0;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.trackCoils = [];
    this.fieldArcs = [];
    this.flowPhase = 0;
    this.lastCoilSpacing = -1;

    this.setupLights();
    this.buildGuideway();
    this.buildFuturisticTrain();
    this.buildAirGapFieldLines();
    this.buildHeightIndicator();
    this.buildVectors();

    this.handleResize = this.onResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0x93c5fd, 0.65);
    this.scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xe0f2fe, 1.9);
    sunLight.position.set(8, 12, 9);
    this.scene.add(sunLight);

    const accentLight = new THREE.PointLight(0x8b5cf6, 2.2, 20);
    accentLight.position.set(-7, 4, -5);
    this.scene.add(accentLight);

    this.gapGlowLight = new THREE.PointLight(0x06b6d4, 2.0, 12);
    this.gapGlowLight.position.set(0, 0.9, 0);
    this.scene.add(this.gapGlowLight);
  }

  buildGuideway() {
    this.guidewayGroup = new THREE.Group();

    // Base de ingeniería con grilla
    const grid = new THREE.GridHelper(28, 28, 0x1e293b, 0x0f172a);
    grid.position.y = -0.75;
    this.scene.add(grid);

    // Viga principal de la vía Maglev (a lo largo del eje X)
    const beamGeo = new THREE.BoxGeometry(24, 0.45, 2.3);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.7,
      roughness: 0.32
    });
    const mainBeam = new THREE.Mesh(beamGeo, beamMat);
    mainBeam.position.y = 0.0;

    // Riel central de inducción lineal (LSM stator)
    const statorGeo = new THREE.BoxGeometry(24, 0.08, 0.55);
    this.statorMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      metalness: 0.6,
      roughness: 0.2
    });
    const statorRail = new THREE.Mesh(statorGeo, this.statorMat);
    statorRail.position.y = 0.25;

    this.guidewayGroup.add(mainBeam, statorRail);

    // Contenedor de electroimanes distribuidos en la vía (se reconstruye/actualiza según separación 10..100 cm)
    this.coilsContainer = new THREE.Group();
    this.guidewayGroup.add(this.coilsContainer);

    // Marcadores de referencia visual de velocidad sobre la vía
    this.trackSleepersGroup = new THREE.Group();
    const sleeperGeo = new THREE.BoxGeometry(0.12, 0.03, 2.25);
    const sleeperMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35
    });
    this.sleepers = [];
    for (let i = -12; i <= 12; i++) {
      const sMesh = new THREE.Mesh(sleeperGeo, sleeperMat);
      sMesh.position.set(i * 1.0, 0.24, 0);
      this.trackSleepersGroup.add(sMesh);
      this.sleepers.push(sMesh);
    }
    this.guidewayGroup.add(this.trackSleepersGroup);

    // Etiqueta de electroimanes de vía
    this.trackPoleLabel = createTextSprite('Electroimanes de Vía (Polos N / S)', {
      textColor: '#bae6fd',
      borderColor: '#06b6d4',
      scale: 0.54
    });
    this.trackPoleLabel.position.set(0, -0.45, 1.55);
    this.guidewayGroup.add(this.trackPoleLabel);

    this.scene.add(this.guidewayGroup);
  }

  /**
   * Distribuye los electroimanes a lo largo de la vía según coilSpacingCm (10 a 100 cm).
   * Escala longitudinal visual: 10 cm = 0.32 unidades 3D, 100 cm = 2.2 unidades 3D.
   */
  rebuildTrackCoils(coilSpacingCm) {
    this.lastCoilSpacing = coilSpacingCm;
    while (this.coilsContainer.children.length > 0) {
      this.coilsContainer.remove(this.coilsContainer.children[0]);
    }
    this.trackCoils = [];

    const spacing3D = 0.32 + ((coilSpacingCm - 10) / 90) * 1.75;
    const halfSpan = 10.5;
    const count = Math.floor((halfSpan * 2) / spacing3D);

    const coilGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.14, 18);
    const coreGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.17, 14);

    for (let i = 0; i <= count; i++) {
      const baseX = -halfSpan + i * spacing3D;
      const isNorth = i % 2 === 0;
      const poleColor = isNorth ? 0xef4444 : 0x2563eb;

      const coilMat = new THREE.MeshStandardMaterial({
        color: poleColor,
        emissive: poleColor,
        emissiveIntensity: 0.35,
        metalness: 0.5,
        roughness: 0.25
      });

      const copperMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.25,
        metalness: 0.75,
        roughness: 0.2
      });

      // Par de bobinas (riel izquierdo z = +0.78 y riel derecho z = -0.78)
      const pairGroup = new THREE.Group();
      for (const zSign of [-1, 1]) {
        const winding = new THREE.Mesh(coilGeo, copperMat);
        winding.position.set(0, 0.28, zSign * 0.78);
        const poleCore = new THREE.Mesh(coreGeo, coilMat);
        poleCore.position.set(0, 0.28, zSign * 0.78);
        pairGroup.add(winding, poleCore);
      }

      pairGroup.position.x = baseX;
      this.coilsContainer.add(pairGroup);
      this.trackCoils.push({
        group: pairGroup,
        baseX,
        coilMat,
        copperMat
      });
    }
  }

  buildFuturisticTrain() {
    this.trainGroup = new THREE.Group();

    // 1. Cuerpo principal aerodinámico del tren Maglev
    const bodyGeo = new THREE.BoxGeometry(4.4, 0.92, 1.85);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.65,
      roughness: 0.2
    });
    const mainBody = new THREE.Mesh(bodyGeo, bodyMat);
    mainBody.position.y = 0.68;

    // Morro aerodinámico delantero (+X) y trasero (-X)
    const noseGeo = new THREE.ConeGeometry(0.92, 1.45, 24);
    noseGeo.rotateZ(-Math.PI / 2);
    noseGeo.scale(1, 0.52, 1.0);
    const frontNose = new THREE.Mesh(noseGeo, bodyMat);
    frontNose.position.set(2.85, 0.52, 0);

    const rearNoseGeo = new THREE.ConeGeometry(0.92, 1.2, 24);
    rearNoseGeo.rotateZ(Math.PI / 2);
    rearNoseGeo.scale(1, 0.52, 1.0);
    const rearNose = new THREE.Mesh(rearNoseGeo, bodyMat);
    rearNose.position.set(-2.75, 0.52, 0);

    // Franja luminosa cian/violeta a lo largo del fuselaje
    const stripeGeo = new THREE.BoxGeometry(4.8, 0.09, 1.89);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.52;

    // Cúpula / Ventanas panorámicas oscuras
    const canopyGeo = new THREE.BoxGeometry(3.8, 0.34, 1.62);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.9,
      roughness: 0.1
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 0.95;

    // 2. Elementos magnéticos en la parte inferior del tren (Bogies superconductores N/S)
    this.trainMagnetsGroup = new THREE.Group();
    const numBogieMagnets = 5;
    for (let i = 0; i < numBogieMagnets; i++) {
      const xPos = -1.7 + i * 0.85;
      const isNorth = i % 2 === 0;
      const magColor = isNorth ? 0xef4444 : 0x3b82f6;

      const padGeo = new THREE.BoxGeometry(0.58, 0.14, 1.72);
      const padMat = new THREE.MeshStandardMaterial({
        color: magColor,
        emissive: magColor,
        emissiveIntensity: 0.45,
        metalness: 0.55,
        roughness: 0.25
      });
      const magPad = new THREE.Mesh(padGeo, padMat);
      magPad.position.set(xPos, 0.12, 0);
      this.trainMagnetsGroup.add(magPad);
    }

    this.trainMagnetLabel = createTextSprite('Imanes Inferiores del Tren (N/S)', {
      textColor: '#f3e8ff',
      borderColor: '#a855f7',
      scale: 0.52
    });
    this.trainMagnetLabel.position.set(0, 0.08, -1.35);

    this.trainGroup.add(
      mainBody,
      frontNose,
      rearNose,
      stripe,
      canopy,
      this.trainMagnetsGroup,
      this.trainMagnetLabel
    );

    this.scene.add(this.trainGroup);
  }

  buildAirGapFieldLines() {
    this.fieldGroup = new THREE.Group();
    this.fieldArcs = [];

    // Creamos 10 lazos tridimensionales de campo magnético en el entrehierro (vía <-> base del tren)
    const xPositions = [-1.8, -0.9, 0.0, 0.9, 1.8];
    const zSides = [-0.78, 0.78];

    for (const x0 of xPositions) {
      for (const z0 of zSides) {
        const pts = [
          new THREE.Vector3(x0 - 0.28, 0.32, z0),
          new THREE.Vector3(x0 - 0.18, 0.75, z0 * 1.25),
          new THREE.Vector3(x0, 1.05, z0 * 1.05),
          new THREE.Vector3(x0 + 0.18, 0.75, z0 * 1.25),
          new THREE.Vector3(x0 + 0.28, 0.32, z0)
        ];
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.018, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: z0 > 0 ? 0x22d3ee : 0xa855f7,
          transparent: true,
          opacity: 0.65
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);

        // Cono direccional animado sobre el arco magnético
        const coneGeo = new THREE.ConeGeometry(0.05, 0.14, 10);
        coneGeo.rotateX(Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.95
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);

        this.fieldGroup.add(tubeMesh, coneMesh);
        this.fieldArcs.push({
          tubeMesh,
          tubeMat,
          coneMesh,
          coneMat,
          curve,
          phaseOffset: Math.abs(x0 * 0.3 + (z0 > 0 ? 0.2 : 0.6)) % 1
        });
      }
    }

    this.scene.add(this.fieldGroup);
  }

  buildHeightIndicator() {
    this.heightGaugeGroup = new THREE.Group();
    this.heightGaugeGroup.position.set(-3.3, 0.32, 0.95);

    // Columna vertical graduada (0 a 50 cm; escala 3D: 1 cm = 0.045 unidades 3D)
    const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.5, 12);
    postGeo.translate(0, 1.25, 0);
    const post = new THREE.Mesh(postGeo, new THREE.MeshBasicMaterial({ color: 0x475569 }));
    this.heightGaugeGroup.add(post);

    // Marcador de altura real del tren
    this.actualHeightSprite = createTextSprite('Entrehierro: 12.0 cm', {
      textColor: '#67e8f9',
      borderColor: '#06b6d4',
      scale: 0.56
    });
    this.actualHeightSprite.position.set(-0.95, 0.5, 0);
    this.heightGaugeGroup.add(this.actualHeightSprite);

    this.scene.add(this.heightGaugeGroup);
  }

  buildVectors() {
    // Vector Gravedad Fg (hacia abajo, ámbar)
    this.gravityVec = new DynamicVector3D(0xf59e0b, 'Fg', '#f59e0b');
    // Vector Fuerza Electromagnética Fem (hacia arriba, cian)
    this.emForceVec = new DynamicVector3D(0x06b6d4, 'Fem', '#06b6d4');
    // Vector Velocidad / Propulsión v (horizontal +X, violeta)
    this.velocityVec = new DynamicVector3D(0xa855f7, 'v', '#a855f7');

    this.scene.add(this.gravityVec.group, this.emForceVec.group, this.velocityVec.group);
  }

  updateFromPhysics(telemetry, physicsInstance, dt) {
    // 1. Reconstruir electroimanes si cambió la separación (10..100 cm)
    if (this.lastCoilSpacing !== telemetry.coilSpacingCm) {
      this.rebuildTrackCoils(telemetry.coilSpacingCm);
    }

    // 2. Desplazar visualmente las traviesas y electroimanes según la posición en vía (efecto de movimiento continuo)
    const spacing3D = 0.32 + ((telemetry.coilSpacingCm - 10) / 90) * 1.75;
    const travelOffset = (physicsInstance.trackPositionMeters * 0.45) % (spacing3D * 2);

    this.trackCoils.forEach((coil) => {
      let x = coil.baseX - travelOffset;
      if (x < -11.0) x += 22.0;
      coil.group.position.x = x;

      const currentNorm = telemetry.electricCurrentNorm / 100;
      coil.coilMat.emissiveIntensity = 0.1 + currentNorm * 0.7;
      coil.copperMat.emissiveIntensity = 0.05 + currentNorm * 0.55;
    });

    const sleeperOffset = (physicsInstance.trackPositionMeters * 0.45) % 1.0;
    this.sleepers.forEach((s, idx) => {
      s.position.x = (idx - 12) * 1.0 - sleeperOffset;
    });

    // 3. Posición vertical y cabeceo del tren (0 cm = apoyado en y = 0.32; 1 cm = 0.045 unidades 3D)
    const trackSurfaceY = 0.32;
    const trainGapY = telemetry.actualHeightCm * 0.045;
    this.trainGroup.position.y = trackSurfaceY + trainGapY;
    this.trainGroup.rotation.z = physicsInstance.pitchRad;

    // 4. Indicador 3D de altura de levitación
    this.actualHeightSprite.position.y = Math.max(0.2, trainGapY);
    updateTextSprite(
      this.actualHeightSprite,
      `Altura: ${telemetry.actualHeightCm.toFixed(1)} cm`
    );

    // 5. Actualizar Líneas de Campo Magnético 3D en el entrehierro
    const fieldStrength = (telemetry.magneticIntensityNorm / 100) * (telemetry.electricCurrentNorm / 100);
    this.fieldGroup.visible = physicsInstance.showFieldLines && fieldStrength > 0.01;
    this.gapGlowLight.intensity = fieldStrength * 2.8;

    if (this.fieldGroup.visible) {
      const verticalStretch = Math.max(0.45, 0.55 + trainGapY * 0.9);
      this.fieldGroup.scale.set(1, verticalStretch, 1);

      this.flowPhase = (this.flowPhase + dt * (0.35 + fieldStrength * 0.85)) % 1;
      for (const arc of this.fieldArcs) {
        arc.tubeMat.opacity = 0.2 + fieldStrength * 0.65;
        const u = (arc.phaseOffset + this.flowPhase) % 1;
        const pos = arc.curve.getPointAt(u);
        const tangent = arc.curve.getTangentAt(u).normalize();
        arc.coneMesh.position.copy(pos);
        arc.coneMesh.lookAt(pos.clone().add(tangent));
        arc.coneMat.opacity = 0.3 + fieldStrength * 0.7;
      }
    }

    // 6. Actualizar Vectores 3D (Fg, Fem, Velocidad)
    const trainCenter = new THREE.Vector3(0, this.trainGroup.position.y + 0.65, 1.15);
    const fgkN = telemetry.gravityForceN / 1000;
    const femkN = telemetry.electromagneticForceN / 1000;

    const fgLen = Math.min(2.1, Math.max(0.45, Math.log10(fgkN + 1) * 0.95));
    const femLen =
      femkN > 0.05 ? Math.min(2.2, Math.max(0.4, Math.log10(femkN + 1) * 0.95)) : 0;

    this.gravityVec.update(
      trainCenter.clone().add(new THREE.Vector3(-0.55, 0, 0)),
      new THREE.Vector3(0, -1, 0),
      fgLen,
      `Fg = ${fgkN.toFixed(1)} kN`
    );

    this.emForceVec.update(
      trainCenter.clone().add(new THREE.Vector3(0.55, 0, 0)),
      new THREE.Vector3(0, 1, 0),
      femLen,
      `Fem = ${femkN.toFixed(1)} kN`
    );

    const vLen = telemetry.speedKmh > 1 ? 0.5 + (telemetry.speedKmh / 300) * 1.65 : 0;
    this.velocityVec.update(
      new THREE.Vector3(2.4, this.trainGroup.position.y + 0.6, 0),
      new THREE.Vector3(1, 0, 0),
      vLen,
      `v = ${telemetry.speedKmh.toFixed(0)} km/h`
    );

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

