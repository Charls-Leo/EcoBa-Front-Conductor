# EcoBahía

<img width="536" height="1024" alt="image" src="https://github.com/user-attachments/assets/5452ecd4-4494-4c43-a3c0-bdc1e2fce71a" />



## Descripción general

**EcoBahía** es una aplicación enfocada en la **gestión inteligente de recolección de residuos**, pensada para ayudar a mantener la ciudad más limpia, organizada y mejor gestionada.

La app busca ofrecer una experiencia moderna, clara y ecológica para que los usuarios puedan consultar información importante sobre el servicio, reportar incidencias y acceder a funcionalidades útiles desde un solo lugar.

---

## Idea principal del proyecto

EcoBahía nace como una solución digital para mejorar la interacción entre los ciudadanos y el sistema de recolección de residuos.

La aplicación permitirá, entre otras cosas:

- visualizar información relacionada con la recolección de residuos
- consultar rutas o recorridos
- reportar problemas o incidencias
- acceder a información útil sobre el funcionamiento del servicio
- iniciar sesión para acceder a funciones personalizadas

---

## Referencia visual

Para la construcción inicial de la interfaz se tomó como inspiración una referencia visual tipo app ecológica con tres pantallas principales:

1. **Splash screen**
2. **Onboarding informativo**
3. **Home principal con accesos rápidos**

> La referencia se usó únicamente como base de estilo, estructura y experiencia visual.  
> No se pretende copiarla exactamente, sino adaptarla a la identidad de **EcoBahía**.

---

## Estructura base definida

Dentro de `src/app` se definió una organización modular basada en:

```bash
src/app/
├── core/
├── shared/
└── features/
```

Y dentro de features/ se ha venido planteando una estructura orientada a los módulos principales del sistema, por ejemplo:
```bash
features/
├── auth/
│   └── login/
├── ciudadano/
│   ├── mapa/
│   └── rutas/
├── conductor/
│   ├── home/
│   └── seleccion/
└── inicio/
    ├── splash/
    ├── onboarding/
    └── home/
```

## Flujo inicial definido

Se redefinió el enfoque inicial del proyecto para trabajar la entrada de la app como una experiencia real de aplicación móvil, en lugar de una landing genérica.

**Flujo actual**
1. Splash screen
2. Onboarding
3. Home principal
4. Más adelante: login, registro e integración con módulos reales

---

## Pantallas desarrolladas hasta el momento

### 1. Splash screen

Primera pantalla de entrada de la aplicación.

**Características implementadas:**

- muestra el nombre EcoBahía
- diseño limpio, minimalista y ecológico
- ilustración decorativa en la parte inferior
- aparece automáticamente al ingresar
- desaparece después de unos segundos
- redirige al onboarding



### 2. Onboarding

Se construyó una secuencia de pantallas informativas para presentar el propósito de la app.

**Contenido actual:**

- **Pantalla 1**: Reporta incidencias
- **Pantalla 2**: Consulta rutas y recorridos
- **Pantalla 3**: Gestiona todo en un solo lugar

**Características implementadas:**

- navegación entre pantallas
- indicadores inferiores tipo puntos
- botón de siguiente
- botón de omitir
- botón final de comenzar


### 3. Home principal 

Se construyó una primera versión de la página principal de la aplicación.

**Incluye:**
- identidad visual de EcoBahía
- bienvenida al usuario
- tarjetas o módulos de acceso rápido
- sección visual principal
- navegación inferior tipo app móvil

**Módulos iniciales representados:**
- Reportar
- Rutas
- Mapa
- Información
- Ayuda
- Perfil

---

## Tecnologías utilizadas

- Ionic
- Angular
- TypeScript
- HTML
- CSS
- Git
- GitHub

---

## Organización del desarrollo

El proyecto se está trabajando mediante ramas para mantener orden en la evolución del código.

**Ramas usadas hasta el momento**
- main
- develop
- feature/estructura-base

Actualmente, los avances del flujo inicial de interfaz fueron trabajados en la rama:
- feature/estructura-base
- Archivos principales desarrollados hasta ahora

Dentro de src/app/features/inicio/ se construyeron las páginas base:
```bash
inicio/
├── splash/
│   ├── splash.page.ts
│   ├── splash.page.html
│   └── splash.page.css
├── onboarding/
│   ├── onboarding.page.ts
│   ├── onboarding.page.html
│   └── onboarding.page.css
└── home/
    ├── home.page.ts
    ├── home.page.html
    └── home.page.css
```

## Cómo ejecutar el proyecto

Desde la carpeta del frontend:
```bash
npm install
ionic serve
```
O alternativamente:
```bash
ng serve
```
No se recomienda usar Go Live, ya que el proyecto está construido con Ionic + Angular y necesita ejecutarse mediante su servidor de desarrollo.
