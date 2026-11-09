/**
 * LevitronScene.js
 * Escenario tridimensional interactivo para el Simulador A: LEVITRON.
 * Incluye:
 * - Base circular de laboratorio.
 * - Imán permanente inferior (con polos N y S y escalado dinámico 1..10).
 * - Trompo magnético suspendido con rotación (0..3000 RPM), precesión y nutación.
 * - Líneas 3D de campo magnético dipolar + conos animados de dirección de flujo (N -> S).
 * - Vectores dinámicos 3D de Fuerza Gravitacional (Fg) y Fuerza Magnética (Fmag).
 * - Indicador láser 3D de altura de levitación en centímetros.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTextSprite, updateTextSprite, DynamicVector3D } from './SceneUtils.js';

export class LevitronScene {
  constructor(containerEl) {
    this.container = containerEl;
    this.width = containerEl.clientWidth || 600;
    this.height = containerEl.clientHeight || 440;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a14);
    this.scene.fog = new THREE.FogExp2(0x060a14, 0.032);

    this.camera = new THREE.PerspectiveCamera(44, this.width / this.height, 0.1, 100);
    this.camera.position.set(5.6, 4.4, 6.8);

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
    this.controls.target.set(0, 2.0, 0);
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.flowPhase = 0;
    this.fieldFlowMarkers = [];
    this.fieldLineMaterials = [];

    this.setupLights();
    this.buildEnvironment();
    this.buildBaseAndMagnet();
    this.buildSuspendedTop();
    this.buildMagneticFieldLines();
    this.buildHeightGauge();
    this.buildForceVectors();

    this.handleResize = this.onResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0x88b4ff, 0.65);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.8);
    keyLight.position.set(6, 10, 7);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x8b5cf6, 2.2, 16);
    rimLight.position.set(-5, 4, -4);
    this.scene.add(rimLight);

    this.coreGlowLight = new THREE.PointLight(0x06b6d4, 1.8, 10);
    this.coreGlowLight.position.set(0, 1.2, 0);
    this.scene.add(this.coreGlowLight);
  }

  buildEnvironment() {
    // Rejilla polar científica en el piso del laboratorio
    const polarGrid = new THREE.PolarGridHelper(6.5, 16, 8, 64, 0x1e293b, 0x0f172a);
    polarGrid.position.y = -0.35;
    this.scene.add(polarGrid);
  }

  /**
   * Construye una geometría 3D de anillo hueco (imán toroidal / anular de sección rectangular)
   * con radio exterior `outerR`, radio interior del agujero `innerR` y espesor `height`.
   */
  createHollowRingGeometry(outerR, innerR, height, segments = 48) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);

    const holePath = new THREE.Path();
    holePath.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(holePath);

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      curveSegments: segments
    });

    extrudeGeo.rotateX(-Math.PI / 2);
    extrudeGeo.center();
    return extrudeGeo;
  }

  buildBaseAndMagnet() {
    // 1. Plataforma circular fija de laboratorio con cavidad central oscura
    this.pedestalGroup = new THREE.Group();
    const basePlatformGeo = this.createHollowRingGeometry(3.0, 0.48, 0.34, 56);
    const basePlatformMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.75,
      roughness: 0.28
    });
    const basePlatform = new THREE.Mesh(basePlatformGeo, basePlatformMat);
    basePlatform.position.y = -0.18;

    // Fondo oscuro del pozo central para acentuar visualmente el hueco del imán anular
    const wellBottomGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 36);
    const wellBottomMat = new THREE.MeshBasicMaterial({ color: 0x03060c });
    const wellBottom = new THREE.Mesh(wellBottomGeo, wellBottomMat);
    wellBottom.position.y = -0.32;

    const ringGeo = new THREE.TorusGeometry(2.95, 0.035, 16, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const glowRing = new THREE.Mesh(ringGeo, ringMat);
    glowRing.position.y = 0.0;

    this.pedestalGroup.add(basePlatform, wellBottom, glowRing);
    this.scene.add(this.pedestalGroup);

    // 2. Imán permanente en forma de ANILLO (Imán Anular) en la base (Escalable según Tamaño 1..10)
    // Radio exterior = 1.22, Radio interior del agujero = 0.54
    // Cara superior = Polo Norte (Rojo #ef4444), Cara inferior = Polo Sur (Azul #2563eb)
    this.baseMagnetGroup = new THREE.Group();

    const outerR = 1.22;
    const innerR = 0.54;
    const halfHeight = 0.21;

    const northRingGeo = this.createHollowRingGeometry(outerR, innerR, halfHeight, 48);
    this.baseNorthMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.38,
      metalness: 0.48,
      roughness: 0.24
    });
    const northHalf = new THREE.Mesh(northRingGeo, this.baseNorthMat);
    northHalf.position.y = 0.33;

    const southRingGeo = this.createHollowRingGeometry(outerR, innerR, halfHeight, 48);
    this.baseSouthMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.38,
      metalness: 0.48,
      roughness: 0.24
    });
    const southHalf = new THREE.Mesh(southRingGeo, this.baseSouthMat);
    southHalf.position.y = 0.11;

    // Aro luminoso interior que resalta el borde del agujero central del imán anular
    const innerHoleRimGeo = new THREE.TorusGeometry(innerR, 0.018, 12, 48);
    innerHoleRimGeo.rotateX(Math.PI / 2);
    const innerHoleRimMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75
    });
    const innerHoleRimTop = new THREE.Mesh(innerHoleRimGeo, innerHoleRimMat);
    innerHoleRimTop.position.y = 0.44;

    this.baseMagnetMeshGroup = new THREE.Group();
    this.baseMagnetMeshGroup.add(northHalf, southHalf, innerHoleRimTop);
    this.baseMagnetGroup.add(this.baseMagnetMeshGroup);

    // Etiquetas de polos del imán anular base
    this.baseNorthLabel = createTextSprite('POLO N (Anillo Base)', {
      textColor: '#fecaca',
      borderColor: '#ef4444',
      scale: 0.52
    });
    this.baseNorthLabel.position.set(1.65, 0.38, 0);

    this.baseSouthLabel = createTextSprite('POLO S (Anillo Base)', {
      textColor: '#bfdbfe',
      borderColor: '#3b82f6',
      scale: 0.52
    });
    this.baseSouthLabel.position.set(1.65, 0.06, 0);

    this.baseMagnetGroup.add(this.baseNorthLabel, this.baseSouthLabel);
    this.scene.add(this.baseMagnetGroup);
  }

  buildSuspendedTop() {
    // Grupo externo (posición vertical y precesión) -> Grupo interno (inclinación y giro RPM)
    this.topAnchorGroup = new THREE.Group();
    this.topTiltGroup = new THREE.Group();
    this.topSpinGroup = new THREE.Group();

    // El trompo también utiliza un imán anular (con hueco interior atravesado por el vástago no magnético)
    // Cara inferior = Polo N (#ef4444) en repulsión contra el Polo N superior del anillo base,
    // Cara superior = Polo S (#3b82f6).
    const topOuterR = 0.62;
    const topInnerR = 0.22;

    const topSouthGeo = this.createHollowRingGeometry(topOuterR, topInnerR, 0.11, 36);
    const topSouthMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.3,
      metalness: 0.55,
      roughness: 0.22
    });
    const topSouthRing = new THREE.Mesh(topSouthGeo, topSouthMat);
    topSouthRing.position.y = 0.06;

    const topNorthGeo = this.createHollowRingGeometry(topOuterR, topInnerR, 0.11, 36);
    const topNorthMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.35,
      metalness: 0.55,
      roughness: 0.22
    });
    const topNorthRing = new THREE.Mesh(topNorthGeo, topNorthMat);
    topNorthRing.position.y = -0.06;

    // Buje interior no magnético que une el anillo del trompo con el husillo central
    const hubGeo = new THREE.CylinderGeometry(topInnerR, topInnerR, 0.06, 24);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.4,
      roughness: 0.5
    });
    const hubMesh = new THREE.Mesh(hubGeo, hubMat);

    // Eje o husillo del trompo Levitron
    const spindleGeo = new THREE.CylinderGeometry(0.065, 0.04, 0.88, 20);
    const spindleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.15
    });
    const spindle = new THREE.Mesh(spindleGeo, spindleMat);
    spindle.position.y = 0.12;

    // Punta inferior cónica del trompo
    const tipGeo = new THREE.ConeGeometry(0.065, 0.2, 16);
    tipGeo.rotateX(Math.PI);
    const tip = new THREE.Mesh(tipGeo, spindleMat);
    tip.position.y = -0.36;

    // Marcas estroboscópicas sobre el anillo para apreciar los RPM sin tapar el agujero central
    const finGeo = new THREE.BoxGeometry(0.36, 0.028, 0.08);
    const finMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    for (let k = 0; k < 4; k++) {
      const fin = new THREE.Mesh(finGeo, finMat);
      const ang = (k * Math.PI) / 2;
      fin.position.set(Math.cos(ang) * 0.42, 0.13, Math.sin(ang) * 0.42);
      fin.rotation.y = -ang;
      this.topSpinGroup.add(fin);
    }

    this.topSpinGroup.add(topSouthRing, topNorthRing, hubMesh, spindle, tip);
    this.topTiltGroup.add(this.topSpinGroup);

    // Etiquetas de polos en el objeto suspendido (no rotan con el husillo para ser legibles)
    this.topPoleLabel = createTextSprite('S ↑ / N ↓ (Repulsión)', {
      textColor: '#e0f2fe',
      borderColor: '#a855f7',
      scale: 0.52
    });
    this.topPoleLabel.position.set(-1.35, 0.05, 0);
    this.topTiltGroup.add(this.topPoleLabel);

    this.topAnchorGroup.add(this.topTiltGroup);
    this.scene.add(this.topAnchorGroup);
  }

  buildMagneticFieldLines() {
    this.fieldLinesGroup = new THREE.Group();
    this.fieldFlowMarkers = [];
    this.fieldLineMaterials = [];

    const numAzimuth = 8; // 8 planos meridianos alrededor del imán anular
    const outerShells = [1.0, 1.42]; // Lóbulos exteriores del anillo

    // 1. Líneas de campo exteriores (salen de la cara Norte anular r=0.92, rodean por fuera y entran a la cara Sur)
    for (let s = 0; s < outerShells.length; s++) {
      const shellScale = outerShells[s];
      for (let i = 0; i < numAzimuth; i++) {
        const angle = (i / numAzimuth) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const points = [];
        const steps = 32;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps; // 0 (Norte arriba) -> 1 (Sur abajo)
          const theta = t * Math.PI;
          const r = 0.88 + Math.sin(theta) * 1.38 * shellScale;
          const y = 0.24 + Math.cos(theta) * (0.24 + 0.52 * shellScale);
          points.push(new THREE.Vector3(r * cosA, y, r * sinA));
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.018, 8, false);
        const lineColor = s === 0 ? 0x22d3ee : 0x8b5cf6;
        const tubeMat = new THREE.MeshBasicMaterial({
          color: lineColor,
          transparent: true,
          opacity: s === 0 ? 0.65 : 0.42
        });

        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        this.fieldLinesGroup.add(tubeMesh);
        this.fieldLineMaterials.push({ mat: tubeMat, baseOpacity: s === 0 ? 0.65 : 0.42 });

        // Cono direccional que viaja de Norte a Sur
        const coneGeo = new THREE.ConeGeometry(0.055, 0.16, 10);
        coneGeo.rotateX(Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({
          color: s === 0 ? 0x67e8f9 : 0xc084fc,
          transparent: true,
          opacity: 0.92
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        this.fieldLinesGroup.add(coneMesh);

        this.fieldFlowMarkers.push({
          mesh: coneMesh,
          mat: coneMat,
          curve,
          offset: (i / numAzimuth + s * 0.25) % 1
        });
      }
    }

    // 2. Líneas de campo interiores que pasan por el AGUJERO CENTRAL del anillo (crean el pozo radial)
    for (let i = 0; i < numAzimuth; i++) {
      const angle = (i / numAzimuth) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const innerPts = [];
      const steps = 28;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const theta = t * Math.PI;
        // Sale de la cara Norte (r=0.78), se curva hacia el eje central pasando por el hueco (r=0.22) y cierra en el Sur
        const r = 0.78 - Math.sin(theta) * 0.56;
        const y = 0.22 + Math.cos(theta) * 0.68;
        innerPts.push(new THREE.Vector3(r * cosA, y, r * sinA));
      }

      const innerCurve = new THREE.CatmullRomCurve3(innerPts);
      const innerTubeGeo = new THREE.TubeGeometry(innerCurve, 28, 0.015, 8, false);
      const innerTubeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.58
      });
      const innerTubeMesh = new THREE.Mesh(innerTubeGeo, innerTubeMat);
      this.fieldLinesGroup.add(innerTubeMesh);
      this.fieldLineMaterials.push({ mat: innerTubeMat, baseOpacity: 0.58 });
    }

    // Anillo del pozo magnético de repulsión bajo el trompo
    const trapRingGeo = new THREE.TorusGeometry(0.82, 0.016, 12, 48);
    trapRingGeo.rotateX(Math.PI / 2);
    this.trapRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55
    });
    this.trapRingMesh = new THREE.Mesh(trapRingGeo, this.trapRingMat);
    this.trapRingMesh.position.y = 1.6;
    this.fieldLinesGroup.add(this.trapRingMesh);

    this.scene.add(this.fieldLinesGroup);
  }

  buildHeightGauge() {
    this.gaugeGroup = new THREE.Group();
    this.gaugeGroup.position.set(-2.35, 0.44, 0);

    // Poste vertical graduado (0 a 20 cm -> 0 a 4.0 unidades 3D; escala: 1 unidad 3D = 5 cm)
    const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 4.2, 12);
    postGeo.translate(0, 2.1, 0);
    const postMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
    const postMesh = new THREE.Mesh(postGeo, postMat);
    this.gaugeGroup.add(postMesh);

    // Marcas cada 5 cm (1 unidad 3D)
    for (let cm = 0; cm <= 20; cm += 5) {
      const y = cm * 0.2;
      const tickGeo = new THREE.BoxGeometry(0.22, 0.02, 0.02);
      const tick = new THREE.Mesh(tickGeo, new THREE.MeshBasicMaterial({ color: 0x94a3b8 }));
      tick.position.set(0.1, y, 0);
      this.gaugeGroup.add(tick);
    }

    // Indicador láser horizontal móvil que apunta a la altura actual del trompo
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(2.35, 0, 0)
    ]);
    const laserMat = new THREE.LineDashedMaterial({
      color: 0x22d3ee,
      dashSize: 0.12,
      gapSize: 0.08
    });
    this.heightLaserLine = new THREE.Line(laserGeo, laserMat);
    this.heightLaserLine.computeLineDistances();

    this.heightBadgeSprite = createTextSprite('h = 5.5 cm', {
      textColor: '#67e8f9',
      borderColor: '#06b6d4',
      scale: 0.56
    });
    this.heightBadgeSprite.position.set(-0.78, 0, 0);

    this.heightMarkerNode = new THREE.Group();
    this.heightMarkerNode.add(this.heightLaserLine, this.heightBadgeSprite);
    this.gaugeGroup.add(this.heightMarkerNode);

    this.scene.add(this.gaugeGroup);
  }

  buildForceVectors() {
    // Vector Gravedad (hacia abajo, ámbar/rojo)
    this.gravityVector = new DynamicVector3D(0xf59e0b, 'Fg', '#f59e0b');
    // Vector Fuerza Magnética (hacia arriba, cian eléctrico)
    this.magneticVector = new DynamicVector3D(0x06b6d4, 'Fmag', '#06b6d4');

    this.scene.add(this.gravityVector.group, this.magneticVector.group);
  }

  /**
   * Sincroniza la geometría 3D con el estado calculado por LevitronPhysics.
   */
  updateFromPhysics(telemetry, physicsInstance, dt) {
    // 1. Escalar imán base según Tamaño (1..10)
    const sizeScale = 0.55 + (telemetry.baseMagnetSize / 10) * 1.15;
    this.baseMagnetMeshGroup.scale.set(sizeScale, 1, sizeScale);
    this.baseNorthLabel.position.x = 1.1 * sizeScale + 0.55;
    this.baseSouthLabel.position.x = 1.1 * sizeScale + 0.55;

    // 2. Posicionar y rotar el trompo suspendido
    // Escala vertical 3D: 0.44 es la cara superior del imán base; 1 cm = 0.20 unidades 3D
    const baseTopY = 0.44;
    const topY = baseTopY + telemetry.heightCm * 0.2;
    const radialX = Math.cos(physicsInstance.precessionAngle) * physicsInstance.radialOffsetCm * 0.2;
    const radialZ = Math.sin(physicsInstance.precessionAngle) * physicsInstance.radialOffsetCm * 0.2;

    this.topAnchorGroup.position.set(radialX, topY, radialZ);
    this.topTiltGroup.rotation.set(
      Math.sin(physicsInstance.precessionAngle) * physicsInstance.tiltRad,
      0,
      Math.cos(physicsInstance.precessionAngle) * physicsInstance.tiltRad
    );
    this.topSpinGroup.rotation.y = physicsInstance.spinAngle;

    // 3. Actualizar indicador de altura 3D
    this.heightMarkerNode.position.y = telemetry.heightCm * 0.2;
    updateTextSprite(this.heightBadgeSprite, `h = ${telemetry.heightCm.toFixed(1)} cm`);

    // 4. Actualizar Líneas de Campo Magnético 3D
    this.fieldLinesGroup.visible = physicsInstance.showFieldLines && telemetry.magneticFieldTesla > 0;
    const intensityNorm = telemetry.magneticIntensityNorm / 100;
    this.coreGlowLight.intensity = intensityNorm * 2.4;
    this.baseNorthMat.emissiveIntensity = 0.15 + intensityNorm * 0.55;
    this.baseSouthMat.emissiveIntensity = 0.15 + intensityNorm * 0.55;

    if (this.fieldLinesGroup.visible) {
      const fieldScaleXZ = 0.65 + (telemetry.baseMagnetSize / 10) * 0.85;
      const fieldScaleY = 0.65 + intensityNorm * 0.85;
      this.fieldLinesGroup.scale.set(fieldScaleXZ, fieldScaleY, fieldScaleXZ);

      this.fieldLineMaterials.forEach(({ mat, baseOpacity }) => {
        mat.opacity = Math.max(0.1, baseOpacity * intensityNorm);
      });

      this.trapRingMesh.position.y = Math.max(0.6, topY / fieldScaleY);
      this.trapRingMat.opacity = 0.25 + intensityNorm * 0.55;

      // Animar conos de dirección de flujo magnético (Norte -> Sur)
      this.flowPhase = (this.flowPhase + dt * (0.22 + intensityNorm * 0.65)) % 1;
      for (const item of this.fieldFlowMarkers) {
        const u = (item.offset + this.flowPhase) % 1;
        const pos = item.curve.getPointAt(u);
        const tangent = item.curve.getTangentAt(u).normalize();
        item.mesh.position.copy(pos);
        item.mesh. lookAt(pos.clone().add(tangent));
        item.mat.opacity = 0.25 + intensityNorm * 0.75;
      }
    }

    // 5. Actualizar Vectores de Fuerza 3D (Fg hacia abajo, Fmag hacia arriba/inclinado)
    const origin = this.topAnchorGroup.position.clone();
    // Escala logarítmica/proporcional suave para que vectores de 0.05 N a 1.5 N sean siempre claros
    const fgLen = Math.min(2.2, Math.max(0.45, Math.sqrt(telemetry.gravityForceN) * 1.65));
    const fmagLen =
      telemetry.magneticForceN > 0.002
        ? Math.min(2.4, Math.max(0.35, Math.sqrt(telemetry.magneticForceN) * 1.65))
        : 0;

    this.gravityVector.update(
      origin.clone().add(new THREE.Vector3(0.28, 0, 0)),
      new THREE.Vector3(0, -1, 0),
      fgLen,
      `Fg = ${telemetry.gravityForceN.toFixed(2)} N`
    );

    const magDir = new THREE.Vector3(
      Math.sin(physicsInstance.tiltRad) * 0.35,
      Math.cos(physicsInstance.tiltRad),
      0
    ).normalize();

    this.magneticVector.update(
      origin.clone().add(new THREE.Vector3(-0.28, 0, 0)),
      magDir,
      fmagLen,
      `Fmag = ${telemetry.magneticForceN.toFixed(2)} N`
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

