import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RutaService } from 'src/app/core/services/ruta.service';
import { Ruta } from 'src/app/core/models';

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './rutas.page.html',
  styleUrls: ['./rutas.page.scss']
})
export class RutasPage implements OnInit, OnDestroy {
  activeNav = 'rutas';
  rutas: Ruta[] = [];
  isLoading = true;
  errorMsg = '';

  private destroy$ = new Subject<void>();

  constructor(
    private location: Location,
    private router: Router,
    private rutaService: RutaService
  ) {}

  ngOnInit(): void {
    this.cargarRutas();
  }

  ionViewWillEnter(): void {
    this.cargarRutas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarRutas(): void {
    this.isLoading = true;
    this.errorMsg = '';

    this.rutaService.getRutas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // La API puede devolver un array directamente o un objeto con data
          this.rutas = Array.isArray(data) ? data : [];
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error cargando rutas:', err);
          this.errorMsg = 'No se pudieron cargar las rutas';
          this.isLoading = false;
        }
      });
  }

  goBack(): void {
    this.location.back();
  }

  verMapa(rutaId: string | number): void {
    this.router.navigate(['/tabs/mapa'], { queryParams: { ruta_id: rutaId } });
  }
}