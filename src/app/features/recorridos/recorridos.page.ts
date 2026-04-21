import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-recorridos',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './recorridos.page.html',
  styleUrls: ['./recorridos.page.scss']
})
export class RecorridosPage implements OnInit {
  activeNav = 'recorridos';
  recorridos: any[] = [];
  isLoading = true;
  errorMsg = '';

  constructor(
    private location: Location,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarRecorridos();
  }

  ionViewWillEnter(): void {
    this.cargarRecorridos();
  }

  cargarRecorridos(): void {
    if (!this.authService.isLoggedIn()) {
      this.isLoading = false;
      this.errorMsg = 'Inicia sesión para ver tus recorridos';
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    this.apiService.getRecorridosConductor().subscribe({
      next: (data) => {
        this.recorridos = data || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando recorridos:', err);
        this.errorMsg = 'No se pudieron cargar los recorridos';
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  setActiveNav(nav: string): void {
    this.activeNav = nav;
    const routes: Record<string, string> = {
      inicio: '/home',
      mapa: '/mapa',
      recorridos: '/recorridos',
      rutas: '/rutas',
      perfil: '/perfil'
    };
    if (routes[nav]) {
      this.router.navigate([routes[nav]]);
    }
  }
}