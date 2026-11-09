# LABORATORIO VIRTUAL DE LEVITACIÓN MAGNÉTICA

Aplicación web educativa de simulación física interactiva y visualización científica 3D desarrollada con **HTML5**, **CSS3**, **JavaScript (ES Modules)**, **Three.js (WebGL + OrbitControls)** y **GSAP**.

---

## 1. Estructura de Archivos

```text
Campos/Video/
├── index.html                      # Estructura principal del Laboratorio Virtual
├── package.json                    # Configuración de dependencias (three, gsap) y scripts
├── README.md                       # Documentación técnica y física del proyecto
├── css/
│   └── styles.css                  # Sistema de diseño oscuro, paneles translúcidos y controles accesibles
├── js/
│   ├── main.js                     # Orquestador de simuladores, controles, presets y bucle de tiempo real
│   ├── physics/
│   │   ├── LevitronPhysics.js      # Motor físico educativo del Simulador A (Levitron)
│   │   └── MaglevPhysics.js        # Motor físico educativo del Simulador B (Tren Maglev)
│   ├── scenes/
│   │   ├── SceneUtils.js           # Sprites 3D de alta resolución y vectores dinámicos 3D
│   │   ├── LevitronScene.js        # Escenario 3D del Levitron, campo dipolar y vectores
│   │   └── MaglevScene.js          # Escenario 3D del Tren Maglev, vía con electroimanes y entrehierro
│   ├── ui/
│   │   ├── PhysicsPanel.js         # Controlador del Centro de Análisis Físico y diagrama vectorial SVG
│   │   └── MotionController.js     # Coreografía de interfaz con GSAP siguiendo la skill motion-design
│   └── vendor/                     # Módulos ES locales de Three.js, OrbitControls y GSAP
└── tests/
    └── verify-lab.mjs              # Suite automatizada de pruebas físicas y verificación de interfaz
```

---

## 2. Tecnologías Utilizadas

- **HTML5 Semántico**: Estructura modular con regiones accesibles (`aria-live`, `role="tablist"`, `<input type="range">` nativos con `aria-valuetext`).
- **CSS3 Moderno**: Diseño responsive tipo laboratorio de ingeniería con paneles translúcidos (`backdrop-filter`), paleta azul eléctrico (`#3b82f6`), cian (`#22d3ee`) y violeta (`#8b5cf6`), y estilizado multi-navegador de controles de rango.
- **JavaScript ES6+ Modular**: Separación estricta entre motores físicos (`js/physics/`), representación tridimensional (`js/scenes/`), análisis vectorial (`js/ui/`) y control de eventos (`js/main.js`).
- **Three.js + OrbitControls**: Renderizado WebGL con iluminación física (`ACESFilmicToneMapping`), geometrías tubulares 3D para líneas de campo magnético, marcadores animados de dirección de flujo ($\text{N} \to \text{S}$), vectores 3D escalables y cámara orbital interactiva.
- **GSAP + Principios `motion-design`**: Animaciones de entrada coreografiadas, transiciones entre modos de visualización y microinteracciones desacopladas del motor físico.

---

## 3. Explicación del Modelo Físico Implementado

### A. Fuerza Gravitacional (Común a ambos simuladores)
$$F_g = m \cdot g, \quad g = 9.81\text{ m/s}^2$$

### B. Simulador A: Levitron (`LevitronPhysics.js`)
1. **Aproximación Axial Dipolo-Anillo**:
   La fuerza repulsiva a lo largo del eje vertical $z$ entre el imán permanente de la base (escala $S \in [1, 10]$, intensidad $I_{\%} \in [0, 100]\%$) y el trompo suspendido con ángulo de inclinación $\theta$ se modela mediante:
   $$F_{\text{mag}}(z, \theta) = \frac{F_{\text{pico}}(S, I_{\%})}{\left[1 + (z / R_c(S))^2\right]^{2.2}} \cdot \cos(\theta)$$
2. **Teorema de Earnshaw y Estabilidad Giroscópica**:
   - Un sistema de imanes permanentes estáticos ($\omega = 0\text{ RPM}$) **no puede alcanzar levitación estable** aunque en un instante dado $F_{\text{mag}} = F_g$, debido al torque magnético de volteo ($\vec{\tau} = \vec{\mu} \times \vec{B}$).
   - Para evitar que el trompo se invierta ($\theta \to 90^\circ$), debe rotar dentro de una **ventana giroscópica crítica** $[\text{RPM}_{\min}, \text{RPM}_{\max}]$:
     - Si $\text{RPM} < \text{RPM}_{\min}$ (aprox. $1050\text{–}1350\text{ RPM}$ según intensidad y masa), el momento angular $L = I\omega$ no logra estabilizar el eje contra el volteo y el objeto cae.
     - Si $\text{RPM} > \text{RPM}_{\max}$ (aprox. $2700\text{ RPM}$), la rigidez excesiva del eje impide seguir adiabáticamente la dirección local de las líneas de campo del pozo magnético.
   - Además, la altura de equilibrio debe ubicarse dentro de la **ventana espacial del pozo de potencial radial** determinada por la geometría del imán base.

### C. Simulador B: Tren Maglev (`MaglevPhysics.js`)
1. **Desacoplamiento entre Suspensión y Propulsión**:
   - **Suspensión Electromagnética**: Genera la sustentación vertical $F_{\text{em}}$ a partir de la interacción entre los electroimanes de la vía (alimentados por la corriente $I_{\%}$ y espaciados cada $d_{\text{coil}} \in [10, 100]\text{ cm}$) y los imanes del tren ($B_{\%}$), **incluso a velocidad $v = 0\text{ km/h}$**.
   - **Propulsión Lineal (LSM)**: Controla la traslación longitudinal del tren ($0\text{ a }300\text{ km/h}$) siempre que el tren se encuentre suspendido sin contacto mecánico con la vía.
2. **Capacidad de Fuerza y Rizado Magnético**:
   $$F_{\text{em,máx}}(h) = F_0 \cdot \left(\frac{B_{\%}}{100}\right)^{1.1} \cdot \left(\frac{I_{\%}}{100}\right)^{1.1} \cdot \eta(d_{\text{coil}}) \cdot \frac{1}{(1 + h / z_0)^{1.75}}$$
   Cuando la separación entre electroimanes $d_{\text{coil}}$ es muy grande ($\ge 75\text{ cm}$), disminuye el factor de acoplamiento $\eta(d_{\text{coil}})$ y aparece un rizado periódico (*magnetic cogging*) que induce oscilaciones e inestabilidad.

---

## 4. Instrucciones para Ejecutar el Proyecto

1. **Instalar dependencias (si aún no están instaladas)**:
   ```powershell
   npm install
   ```
2. **Iniciar el servidor local de desarrollo**:
   ```powershell
   npm start
   ```
   *(Esto ejecuta `npx serve .` y expone la aplicación en `http://localhost:3000`). También puedes usar cualquier servidor estático como `python -m http.server 8080` o la extensión Live Server.*
3. **Ejecutar las pruebas automatizadas del motor físico e interfaz**:
   ```powershell
   npm test
   ```

---

## 5. Limitaciones Conocidas de la Simulación

1. **Aproximación de Campo Axial Reducido**: En lugar de resolver en tiempo real las ecuaciones diferenciales en derivadas parciales de Maxwell ($\nabla \times \vec{B} = \mu_0 \vec{J}$) o integrar el tensor de tensiones de Maxwell sobre mallas de elementos finitos (FEM), se emplean potenciales analíticos axiales calibrados para ejecutarse a $60\text{ FPS}$ en el navegador.
2. **Dinámica Giroscópica Promediada**: La precesión y nutación del Levitron se resuelven mediante ecuaciones efectivas de ángulo de inclinación $\theta(t)$ acopladas al movimiento vertical $z(t)$, en vez de integrar las ecuaciones completas de Euler de cuerpo rígido de 6 grados de libertad con fricción aerodinámica rotacional.
3. **Lazo de Control Maglev Idealizado**: El sistema Maglev combina en un modelo unificado la capacidad de sustentación electromagnética con un regulador PD de altura de entrehierro, sin modelar pérdidas térmicas por efecto Joule ($I^2 R$), saturación ferromagnética no lineal del núcleo ni corrientes de Foucault inducidas en la vía a alta velocidad.

