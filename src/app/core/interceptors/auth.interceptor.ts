import { HttpInterceptorFn } from '@angular/common/http';

// =========================================================
// Interceptor HTTP: Inyección automática de JWT
// Se aplica globalmente — elimina headers manuales
// =========================================================

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Rutas públicas que no necesitan token
  const publicPaths = ['/usuarios/login-conductor', '/usuarios/register'];
  const isPublic = publicPaths.some(path => req.url.includes(path));

  if (isPublic) {
    return next(req);
  }

  const token = localStorage.getItem('ecobahia_driver_token');

  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  return next(req);
};
