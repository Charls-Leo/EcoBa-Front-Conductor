# 📱 EcoBahía Conductor — App Móvil

**EcoBahía Conductor** es la aplicación móvil para los conductores del sistema de gestión inteligente de recolección de residuos. Permite a los conductores iniciar recorridos y transmitir su ubicación GPS en tiempo real al backend.

## 🧩 Rol en el sistema

| Componente | Función |
|---|---|
| 📱 **App móvil** (este repo) | Captura GPS del conductor y la envía en tiempo real al backend |
| 🧠 Backend (Node.js + Express) | Centraliza lógica, BD y sincronización con API externa |
| 🌐 Frontend web (Angular) | Panel de administrador: visualiza conductores en mapa en tiempo real |

---

## 🛠️ Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Angular | 20.x | Framework de la aplicación |
| Ionic | 8.x | Componentes de UI móvil |
| Capacitor | 8.3 | Acceso a GPS y APIs nativas |
| TypeScript | 5.9 | Tipado estricto en todo el proyecto |
| Leaflet | 1.9 | Mapa interactivo |
| Socket.IO Client | 4.x | Comunicación en tiempo real |
| RxJS | 7.8 | Programación reactiva |

---

## 📁 Arquitectura del proyecto

```
src/app/
├── app.component.ts              ← Root component (IonApp + RouterOutlet)
├── app.routes.ts                 ← Lazy loading de todas las rutas
│
├── core/                         ← Servicios, modelos e infraestructura
│   ├── models/
│   │   ├── index.ts              ← Barrel export de todos los modelos
│   │   ├── usuario.model.ts      ← Usuario, LoginRequest/Response
│   │   ├── ruta.model.ts         ← Ruta, GeoJSONGeometry
│   │   ├── recorrido.model.ts    ← Recorrido (asignación conductor-ruta-vehículo)
│   │   ├── vehiculo.model.ts     ← Vehiculo
│   │   └── location.model.ts     ← LocationData, TrackingPayload
│   │
│   ├── services/
│   │   ├── auth.service.ts       ← Login, registro, sesión JWT, perfil
│   │   ├── ruta.service.ts       ← GET /rutas
│   │   ├── recorrido.service.ts  ← Recorridos del conductor (activar, desactivar)
│   │   ├── vehiculo.service.ts   ← GET /vehiculos
│   │   ├── usuario.service.ts    ← GET /usuarios/conductores
│   │   ├── location.service.ts   ← Captura GPS (Capacitor Geolocation)
│   │   ├── websocket.service.ts  ← Conexión Socket.IO al backend (JWT auth)
│   │   ├── tracking.service.ts   ← Orquesta: WS + GPS → envío de ubicaciones + buffer offline
│   │   └── tracking-state.service.ts ← Estado global del recorrido activo
│   │
│   └── interceptors/
│       └── auth.interceptor.ts   ← Inyección automática de JWT en requests HTTP
│
├── auth/                         ← Pantallas de autenticación
│   ├── login/                    ← Inicio de sesión de conductor
│   └── registro/                 ← Registro de conductor
│
├── features/                     ← Pantallas funcionales
│   ├── inicio/
│   │   ├── splash/               ← Pantalla de carga inicial
│   │   ├── onboarding/           ← Tutorial de bienvenida (3 pasos)
│   │   └── home/                 ← Dashboard principal del conductor
│   ├── mapa/                     ← Mapa interactivo con rutas (Leaflet)
│   ├── rutas/                    ← Lista de rutas de recolección
│   ├── recorridos/               ← Iniciar/detener recorridos (activa tracking GPS)
│   ├── perfil/                   ← Datos del conductor logueado
│   ├── reportes/                 ← Reporte de incidencias
│   └── ayuda/                    ← Soporte e información
│
└── layout/
    └── tabs/                     ← Navegación inferior por tabs
```

---

## 🔄 Flujo de la aplicación

```
Splash → Onboarding → Home (dashboard)
                         ├── Recorridos → Iniciar → Mapa (con tracking GPS activo)
                         │                        Tooltip premium: placa + nombre de ruta
                         ├── Rutas (consulta)
                         ├── Mapa (visualización con estilo Google Maps)
                         ├── Reportes
                         ├── Perfil
                         └── Ayuda
```

---

## 📐 Principios de arquitectura

- **Servicios por dominio**: Cada servicio maneja un único recurso. No hay "God Service".
- **Tipado estricto**: Cero usos de `any`. Interfaces definidas en `core/models/`.
- **Interceptor JWT**: Token inyectado automáticamente en todas las requests HTTP.
- **Limpieza RxJS**: Patrón `takeUntil(destroy$)` en todos los componentes.
- **Lazy loading**: Todas las páginas se cargan bajo demanda.
- **Offline-first**: Buffer de ubicaciones cuando no hay conexión WebSocket.
- **Resolución de nombres**: En la pantalla de Recorridos se muestra el nombre de la ruta y la placa/marca del vehículo en lugar de los IDs crudos.

---

## 🗺️ Mapa y Tracking

- **Tiles**: Google Maps (Roadmap) para un aspecto profesional.
- **Sin botones de zoom**: Interfaz limpia, el usuario usa gestos táctiles (pinch-to-zoom).
- **Marcador del conductor**: Círculo azul animado con pulso GPS y ícono SVG de camión.
- **Tooltip premium**: Burbuja flotante sobre el marcador que muestra la **placa del vehículo** y el **nombre de la ruta activa**.
- **Rutas con estilo 3 capas**: Glow (resplandor) + borde oscuro + línea principal vibrante.
- **Marcadores de inicio/fin**: Círculos verde (▶) y rojo (■) con animación de pulso.

---

## 🚀 Cómo ejecutar

### Requisitos
- Node.js 18+
- Ionic CLI (`npm install -g @ionic/cli`)

### Desarrollo (navegador)
```bash
npm install
ionic serve
```

### Build para móvil
```bash
ionic build
npx cap sync
npx cap open android   # o ios
```
