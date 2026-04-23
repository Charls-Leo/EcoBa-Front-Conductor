import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// =========================================================
// TrackingStateService — Mantiene el estado global del recorrido activo
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class TrackingStateService {
  private recorridoIdSubj = new BehaviorSubject<string | null>(null);
  readonly recorridoId$ = this.recorridoIdSubj.asObservable();
  
  private rutaIdSubj = new BehaviorSubject<string | null>(null);

  setRecorrido(id: string | number, rutaId?: string | number): void {
    this.recorridoIdSubj.next(String(id));
    if (rutaId) this.rutaIdSubj.next(String(rutaId));
  }

  clear(): void {
    this.recorridoIdSubj.next(null);
    this.rutaIdSubj.next(null);
  }

  get recorridoActivo(): string | null {
    return this.recorridoIdSubj.value;
  }
  
  get rutaActiva(): string | null {
    return this.rutaIdSubj.value;
  }
}
