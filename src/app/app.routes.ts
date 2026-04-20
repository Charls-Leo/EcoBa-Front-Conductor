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
    path: 'home',
    loadComponent: () =>
      import('./features/inicio/home/home.page').then(m => m.HomePage)
  }
];