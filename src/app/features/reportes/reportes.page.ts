import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss']
})
export class ReportesPage {
  activeNav = '';

  constructor(private location: Location, private router: Router) {}

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