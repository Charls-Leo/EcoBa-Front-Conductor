import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full'
  },
  {
    path: 'splash',
    loadComponent: () =>
      import('./features/inicio/splash/splash.page').then(m => m.SplashPage)
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/inicio/onboarding/onboarding.page').then(m => m.OnboardingPage)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./auth/registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'tabs',
    loadComponent: () => import('./layout/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/inicio/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'recorridos',
        loadComponent: () => import('./features/recorridos/recorridos.page').then(m => m.RecorridosPage)
      },
      {
        path: 'rutas',
        loadComponent: () => import('./features/rutas/rutas.page').then(m => m.RutasPage)
      },
      {
        path: 'mapa',
        loadComponent: () => import('./features/mapa/mapa.page').then(m => m.MapaPage)
      },
      {
        path: 'perfil',
        loadComponent: () => import('./features/perfil/perfil.page').then(m => m.PerfilPage)
      },
      {
        path: 'ayuda',
        loadComponent: () => import('./features/ayuda/ayuda.page').then(m => m.AyudaPage)
      },
      {
        path: 'reportar',
        loadComponent: () => import('./features/reportes/reportes.page').then(m => m.ReportesPage)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'home',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  },
  {
    path: 'mapa',
    redirectTo: '/tabs/mapa',
    pathMatch: 'full'
  },
  {
    path: 'recorridos',
    redirectTo: '/tabs/recorridos',
    pathMatch: 'full'
  },
  {
    path: 'rutas',
    redirectTo: '/tabs/rutas',
    pathMatch: 'full'
  },
  {
    path: 'perfil',
    redirectTo: '/tabs/perfil',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/tabs/home'
  }
];