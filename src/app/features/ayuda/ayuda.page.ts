import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ayuda',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './ayuda.page.html',
  styleUrls: ['./ayuda.page.scss']
})
export class AyudaPage {
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