/**
 * MotionController.js
 * Coreografía de interfaz e interacciones aplicando GSAP y las reglas de la
 * skill `motion-design` de LottieFiles (arquetipo Corporate / Scientific UI:
 * duraciones 200-400ms, ease-out direccional, presupuesto de stagger < 500ms,
 * respeto a prefers-reduced-motion y separación total del motor físico).
 */

import { gsap } from 'gsap';

export class MotionController {
  constructor() {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Coreografía de entrada al cargar el laboratorio (4 actos: Header -> Presets -> Módulos -> Panel Físico)
   * Presupuesto total de stagger < 500ms según director/choreography.md.
   */
  playInitialEntrance() {
    if (this.reducedMotion) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.fromTo(
      '.lab-header',
      { opacity: 0, y: -18 },
      { opacity: 1, y: 0, duration: 0.32 }
    )
      .fromTo(
        '.preset-card',
        { opacity: 0, y: 16, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.26, stagger: 0.06 },
        '-=0.18'
      )
      .fromTo(
        '.simulator-module',
        { opacity: 0, y: 22, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.34, stagger: 0.08 },
        '-=0.16'
      )
      .fromTo(
        '.physics-analysis-aside',
        { opacity: 0, x: 22 },
        { opacity: 1, x: 0, duration: 0.32 },
        '-=0.22'
      );
  }

  /**
   * Feedback visual al activar uno de los 3 Experimentos Preconfigurados.
   */
  animatePresetActivation(cardEl) {
    if (this.reducedMotion || !cardEl) return;

    gsap.fromTo(
      cardEl,
      { scale: 0.97 },
      {
        scale: 1,
        duration: 0.28,
        ease: 'back.out(2.2)'
      }
    );

    gsap.fromTo(
      '.control-slider-card',
      { borderColor: 'rgba(34, 211, 238, 0.55)' },
      {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        duration: 0.65,
        stagger: 0.025,
        ease: 'power2.out'
      }
    );
  }

  /**
   * Microinteracción de pulso cuando cambia el estado de estabilidad del sistema.
   */
  pulseStatusBadge(badgeEl) {
    if (this.reducedMotion || !badgeEl) return;
    gsap.fromTo(
      badgeEl,
      { scale: 0.92, opacity: 0.75 },
      { scale: 1, opacity: 1, duration: 0.24, ease: 'back.out(2)' }
    );
  }

  /**
   * Transición suave al alternar el modo de vista (Vista Dual / Solo Levitron / Solo Maglev).
   */
  transitionSimulatorLayout(targetMode, onCompleteResize) {
    const container = document.getElementById('simulators-Column');
    if (this.reducedMotion || !container) {
      if (onCompleteResize) onCompleteResize();
      return;
    }

    gsap.fromTo(
      container,
      { opacity: 0.82, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.26,
        ease: 'power2.out',
        onComplete: () => {
          if (onCompleteResize) onCompleteResize();
        }
      }
    );
  }
}

