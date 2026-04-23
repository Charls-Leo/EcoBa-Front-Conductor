# EcoBahía Conductor — App Móvil

<img width="636" height="424" alt="image" src="https://github.com/user-attachments/assets/5452ecd4-4494-4c43-a3c0-bdc1e2fce71a" />

## Descripción general

**EcoBahía Conductor** es la aplicación móvil exclusiva para conductores del sistema ecoBahía de gestión inteligente de recolección de residuos.

### Rol de la app en el sistema

| Componente | Función |
|------------|---------|
| 📱 **App móvil** (este repo) | Envía datos del conductor al backend |
| 🧠 Backend (Node.js + Express) | Centraliza toda la lógica de negocio |
| 🌐 Frontend web (Angular) | **Panel de Administrador:** Visualiza datos en mapa en tiempo real y gestiona rutas/vehículos |

La app permite a los conductores:
- Iniciar sesión con credenciales exclusivas de conductor
- Consultar rutas de recolección asignadas
- Visualizar recorridos activos y finalizados
- Ver rutas dibujadas en mapa interactivo (Leaflet)
- Reportar incidencias
- Gestionar su perfil

---

## Stack tecnológico

| Tecnología | Versión |
|------------|---------|
| Angular | 20.x |
| Ionic | 8.x |
| Capacitor | 8.3 |
| TypeScript | 5.9 |
| Leaflet | 1.9 |
| RxJS | 7.8 |

---

## Arquitectura del proyecto

```
src/app/
├── app.component.ts              ← Root component (IonApp + RouterOutlet)
├── app.routes.ts                 ← Lazy loading de todas las rutas
│
├── core/                         ← Servicios, modelos e infraestructura
│   ├── models/
│   │   ├── index.ts              ← Barrel export de todos los modelos
│   │   ├── usuario.model.ts      ← Usuario, LoginRequest/Response, RegisterRequest/Response
│   │   ├── ruta.model.ts         ← Ruta, GeoJSONGeometry
│   │   ├── recorrido.model.ts    ← Recorrido (asignación conductor-ruta-vehículo)
│   │   ├── vehiculo.model.ts     ← Vehiculo
│   │   └── location.model.ts     ← LocationData, TrackingPayload (estructura futura GPS)
│   │
│   ├── services/
│   │   ├── auth.service.ts       ← Login, registro, sesión JWT, perfil
│   │   ├── ruta.service.ts       ← GET /rutas (con normalización de respuesta)
│   │   ├── recorrido.service.ts  ← GET /recorridos_locales/conductor/:id
│   │   ├── vehiculo.service.ts   ← GET /vehiculos (solo lectura)
│   │   ├── usuario.service.ts    ← GET /usuarios/conductores
│   │   ├── location.service.ts   ← Captura GPS (Capacitor Geolocation)
│   │   ├── websocket.service.ts  ← Conexión Socket.IO al backend (con JWT auth)
│   │   ├── tracking.service.ts   ← Emisión GPS, fallback offline y batch upload
│   │   └── tracking-state.service.ts ← Gestión del recorrido activo global
│   │
│   └── interceptors/
│       └── auth.interceptor.ts   ← Inyección automática de JWT en requests HTTP
│
├── auth/                         ← Módulos de autenticación
│   ├── login/
│   │   ├── login.page.ts
│   │   ├── login.page.html
│   │   └── login.page.scss
│   └── registro/
│       ├── registro.page.ts
│       ├── registro.page.html
│       └── registro.page.scss
│
├── features/                     ← Páginas funcionales
│   ├── inicio/
│   │   ├── splash/               ← Pantalla de carga inicial
│   │   ├── onboarding/           ← Tutorial de bienvenida (3 pasos)
│   │   └── home/                 ← Dashboard principal del conductor
│   ├── mapa/                     ← Mapa interactivo con rutas (Leaflet)
│   ├── rutas/                    ← Lista de rutas de recolección
│   ├── recorridos/               ← Recorridos asignados al conductor
│   ├── perfil/                   ← Datos del conductor logueado
│   ├── reportes/                 ← Reporte de incidencias
│   └── ayuda/                    ← Soporte e información
│
└── layout/
    └── tabs/                     ← Navegación inferior por tabs
        ├── tabs.page.ts
        ├── tabs.page.html
        └── tabs.page.scss
```

---

## Principios de arquitectura

### Servicios por dominio
Cada servicio maneja un único recurso del backend. No existe un "God Service" monolítico.

### Tipado estricto
**Cero usos de `any`** en todo el proyecto. Cada endpoint tiene interfaces de request/response definidas en `core/models/`.

### Interceptor de autenticación
El JWT se inyecta automáticamente en todas las requests HTTP mediante `AuthInterceptor`. Las rutas públicas (`/login-conductor`, `/register`) se excluyen automáticamente.

### Gestión de suscripciones RxJS
Todos los componentes usan el patrón `takeUntil(destroy$)` para limpiar suscripciones y prevenir memory leaks:

```typescript
private destroy$ = new Subject<void>();

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}
```

### Lazy loading
Todas las páginas se cargan bajo demanda mediante `loadComponent()` en las rutas.

---

## Flujo de la aplicación

```
Splash → Onboarding → Home (dashboard)
                         ├── Recorridos (requiere login)
                         ├── Rutas (requiere login)
                         ├── Mapa (requiere login)
                         ├── Reportes (requiere login)
                         ├── Perfil (requiere login)
                         └── Ayuda (público)
```

### Flujo de autenticación
```
LoginPage → AuthService.login() → POST /usuarios/login-conductor
                                      ↓
                              localStorage (token + usuario)
                                      ↓
                              AuthInterceptor inyecta JWT automáticamente
```

---

## Endpoints consumidos

| Método | Endpoint | Servicio | Descripción |
|--------|----------|----------|-------------|
| POST | `/usuarios/login-conductor` | AuthService | Login de conductor |
| POST | `/usuarios/register` | AuthService | Registro de conductor |
| GET | `/usuarios/me` | AuthService | Perfil actual |
| GET | `/rutas` | RutaService | Listar rutas |
| GET | `/rutas/:id` | RutaService | Ruta por ID |
| GET | `/recorridos_locales/conductor/:id` | RecorridoService | Recorridos del conductor |
| GET | `/recorridos_locales` | RecorridoService | Todos los recorridos |
| GET | `/vehiculos` | VehiculoService | Listar vehículos |
| GET | `/usuarios/conductores` | UsuarioService | Listar conductores |
| POST | `/recorridos_locales/:id/activar` | RecorridoService | Cambia estado local a 'activo' al iniciar |
| POST | `/recorridos_locales/:id/desactivar`| RecorridoService | Libera recursos al detener el recorrido |

---

## Tracking GPS en Tiempo Real (Implementado)

La aplicación cuenta con un sistema robusto de seguimiento en tiempo real diseñado bajo la filosofía **Offline-First**.

### Arquitectura de Tracking y Limpieza Reactiva
1. **`LocationService`**: Captura la posición precisa vía Capacitor (con fallback para Web). Utiliza `ReplaySubject(1)` para mantener cacheada la última posición y evitar parpadeos visuales al cambiar de tabs.
2. **`TrackingStateService`**: Mantiene en memoria el `recorrido_id` y el `ruta_id` activos. Garantiza que la aplicación sepa si está "En ruta" en cualquier pantalla.
3. **`WebSocketService` & `TrackingService`**: Inician la transmisión mediante `socket.io-client` al backend.
4. **Sincronización REST**: Al presionar "Iniciar" o "Finalizar", se dispara inmediatamente un `POST` al endpoint `/:id/activar` o `/:id/desactivar` para que la Base de Datos sea la única "fuente de verdad" del estado del conductor.
5. **Limpieza Reactiva Visual**: En la página del Mapa (`mapa.page.ts`), una suscripción permanente al `TrackingStateService` escucha cuando el conductor finaliza el viaje (estado `null`) e instantáneamente borra del DOM el marcador del camión y la polilínea de la ruta, previniendo visualizaciones fantasmas.

---

## Cómo ejecutar el proyecto

### Requisitos previos
- Node.js 18+
- npm
- Ionic CLI (`npm install -g @ionic/cli`)

### Instalación y ejecución
```bash
npm install
ionic serve
```

O alternativamente:
```bash
ng serve
```

### Build para Capacitor (móvil)
```bash
ionic build
npx cap sync
npx cap open android   # o ios
```

> No se recomienda usar Go Live, ya que el proyecto está construido con Ionic + Angular y necesita ejecutarse mediante su servidor de desarrollo.
