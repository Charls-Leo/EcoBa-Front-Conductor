import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit {
  activeNav = 'inicio';
  isLoggedIn = false;

  quickAccess = [
    {
      title: 'Recorridos',
      desc: 'Consulta tu recorrido actual',
      route: '/recorridos',
      icon: 'recorridos',
      cardClass: 'card-green'
    },
    {
      title: 'Rutas',
      desc: 'Visualiza rutas asignadas',
      route: '/rutas',
      icon: 'routes',
      cardClass: 'card-orange'
    },
    {
      title: 'Mapa',
      desc: 'Ubicación y seguimiento',
      route: '/mapa',
      icon: 'map',
      cardClass: 'card-blue'
    },
    {
      title: 'Reportes',
      desc: 'Novedades y alertas',
      route: '/reportes',
      icon: 'report',
      cardClass: 'card-purple'
    },
    {
      title: 'Perfil',
      desc: 'Tus datos de acceso',
      route: '/perfil',
      icon: 'profile',
      cardClass: 'card-red'
    },
    {
      title: 'Ayuda',
      desc: 'Soporte e información',
      route: '/ayuda',
      icon: 'help',
      cardClass: 'card-teal'
    }
  ];

  recentActivity = [
    {
      title: 'Ruta asignada',
      sub: 'Recorrido de la mañana confirmado',
      badge: 'Activo',
      badgeClass: 'success',
      icon: 'routes',
      bg: '#e8f7ef',
      iconColor: '#2f9e62'
    },
    {
      title: 'Reporte enviado',
      sub: 'Incidencia registrada correctamente',
      badge: 'Enviado',
      badgeClass: 'info',
      icon: 'report',
      bg: '#eef5ff',
      iconColor: '#4b7bec'
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.checkSession();
  }

  ionViewWillEnter(): void {
    this.checkSession();
  }

  checkSession(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
  }

  goTo(route: string): void {
    this.router.navigate([route]);
  }

  goToTopAction(): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  setActiveNav(nav: string): void {
    this.activeNav = nav;

    if (nav === 'inicio') {
      this.router.navigate(['/inicio']);
    } else if (nav === 'mapa') {
      this.router.navigate(['/mapa']);
    } else if (nav === 'recorridos') {
      this.router.navigate(['/recorridos']);
    } else if (nav === 'rutas') {
      this.router.navigate(['/rutas']);
    } else if (nav === 'perfil') {
      if (this.authService.isLoggedIn()) {
        this.router.navigate(['/perfil']);
      } else {
        this.router.navigate(['/login']);
      }
    }
  }
}