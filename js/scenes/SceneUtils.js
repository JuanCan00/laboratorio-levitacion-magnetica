/**
 * SceneUtils.js
 * Utilidades compartidas de visualización científica 3D en Three.js:
 * - Etiquetas tipo Sprite de alta resolución (polos N/S, vectores, cotas de altura).
 * - Vectores de fuerza 3D dinámicos (tallo cilíndrico + punta cónica + etiqueta).
 */

import * as THREE from 'three';

/**
 * Crea un Sprite 3D con texto nítido renderizado en Canvas 2D.
 */
export function createTextSprite(text, {
  textColor = '#f8fafc',
  bgColor = 'rgba(10, 15, 30, 0.85)',
  borderColor = '#38bdf8',
  fontSize = 36,
  scale = 0.75
} = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `700 ${fontSize}px "Inter", "Segoe UI", monospace`;
  ctx.font = font;

  const metrics = ctx.measureText(text);
  const padX = 28;
  const padY = 18;
  const width = Math.ceil(metrics.width + padX * 2);
  const height = Math.ceil(fontSize + padY * 2);

  canvas.width = width;
  canvas.height = height;

  ctx.font = font;
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;

  // Rectángulo redondeado
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(r, 2);
  ctx.lineTo(width - r, 2);
  ctx.quadraticCurveTo(width - 2, 2, width - 2, r);
  ctx.lineTo(width - 2, height - r);
  ctx.quadraticCurveTo(width - 2, height - 2, width - r, height - 2);
  ctx.lineTo(r, height - 2);
  ctx.quadraticCurveTo(2, height - 2, 2, height - r);
  ctx.lineTo(2, r);
  ctx.quadraticCurveTo(2, 2, r, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);
  const aspect = width / height;
  sprite.scale.set(scale * aspect * 0.48, scale * 0.48, 1);
  sprite.renderOrder = 10;
  sprite.userData = { canvas, ctx, texture, fontSize, padX, padY, bgColor, borderColor, textColor, baseScale: scale };

  return sprite;
}

/**
 * Actualiza el texto de un Sprite creado con createTextSprite sin recrear el objeto 3D.
 */
export function updateTextSprite(sprite, newText) {
  if (!sprite || !sprite.userData || sprite.userData.lastText === newText) return;
  sprite.userData.lastText = newText;

  const { canvas, ctx, texture, fontSize, padX, padY, bgColor, borderColor, textColor, baseScale } = sprite.userData;
  const font = `700 ${fontSize}px "Inter", "Segoe UI", monospace`;
  ctx.font = font;

  const metrics = ctx.measureText(newText);
  const width = Math.ceil(metrics.width + padX * 2);
  const height = Math.ceil(fontSize + padY * 2);

  canvas.width = width;
  canvas.height = height;

  ctx.font = font;
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;

  const r = 14;
  ctx.beginPath();
  ctx.moveTo(r, 2);
  ctx.lineTo(width - r, 2);
  ctx.quadraticCurveTo(width - 2, 2, width - 2, r);
  ctx.lineTo(width - 2, height - r);
  ctx.quadraticCurveTo(width - 2, height - 2, width - r, height - 2);
  ctx.lineTo(r, height - 2);
  ctx.quadraticCurveTo(2, height - 2, 2, height - r);
  ctx.lineTo(2, r);
  ctx.quadraticCurveTo(2, 2, r, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(newText, width / 2, height / 2 + 1);

  const aspect = width / height;
  sprite.scale.set(baseScale * aspect * 0.48, baseScale * 0.48, 1);
  texture.needsUpdate = true;
}

/**
 * Clase para representar un vector físico 3D (Fuerza gravitacional, magnética o velocidad)
 * con cilindro, punta cónica luminosa y etiqueta flotante.
 */
export class DynamicVector3D {
  constructor(colorHex, labelText, borderColor = '#38bdf8') {
    this.group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.3
    });

    const shaftGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 14);
    shaftGeo.translate(0, 0.5, 0);
    this.shaft = new THREE.Mesh(shaftGeo, mat);

    const headGeo = new THREE.ConeGeometry(0.145, 0.34, 16);
    headGeo.translate(0, 0.17, 0);
    this.head = new THREE.Mesh(headGeo, mat);

    this.label = createTextSprite(labelText, {
      borderColor,
      scale: 0.65
    });

    this.group.add(this.shaft, this.head, this.label);
  }

  /**
   * Actualiza origen, dirección, longitud visual y texto de etiqueta del vector.
   */
  update(originVec3, dirVec3, length, labelText = null) {
    if (length <= 0.04) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.copy(originVec3);

    const normDir = dirVec3.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normDir);
    this.group.quaternion.copy(quat);

    const shaftLen = Math.max(0.08, length - 0.32);
    this.shaft.scale.set(1, shaftLen, 1);
    this.head.position.set(0, shaftLen, 0);
    this.label.position.set(0.45, shaftLen + 0.22, 0);

    if (labelText) {
      updateTextSprite(this.label, labelText);
    }
  }
}

