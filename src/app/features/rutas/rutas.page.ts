import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { ApiService } from 'src/app/core/services/api.service';

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './rutas.page.html',
  styleUrls: ['./rutas.page.scss']
})
export class RutasPage implements OnInit {
  activeNav = 'rutas';
  rutas: any[] = [];
  isLoading = true;
  errorMsg = '';

  constructor(
    private location: Location,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.cargarRutas();
  }

  ionViewWillEnter(): void {
    this.cargarRutas();
  }

  cargarRutas(): void {
    this.isLoading = true;
    this.errorMsg = '';

    this.apiService.getRutas().subscribe({
      next: (data) => {
        // La API puede devolver un array directamente o un objeto con data
        this.rutas = Array.isArray(data) ? data : (data?.data || data?.rutas || []);
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