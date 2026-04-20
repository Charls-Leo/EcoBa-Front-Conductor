import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage {
  quickAccess = [
    {
      title: 'Reportar',
      desc: 'Registra un problema o incidencia',
      cardClass: 'card-orange',
      icon: 'report'
    },
    {
      title: 'Rutas',
      desc: 'Horarios y recorridos activos',
      cardClass: 'card-blue',
      icon: 'routes'
    },
    {
      title: 'Mapa',
      desc: 'Explora zonas y puntos de acopio',
      cardClass: 'card-green',
      icon: 'map'
    },
    {
      title: 'Información',
      desc: 'Guías sobre reciclaje y residuos',
      cardClass: 'card-purple',
      icon: 'info'
    },
    {
      title: 'Ayuda',
      desc: 'Soporte y preguntas frecuentes',
      cardClass: 'card-red',
      icon: 'help'
    },
    {
      title: 'Perfil',
      desc: 'Tu cuenta y preferencias',
      cardClass: 'card-teal',
      icon: 'profile'
    }
  ];

  recentActivity = [
    {
      title: 'Reporte enviado',
      sub: 'Calle 5 con Av. del Puerto · hace 2h',
      badge: 'Pendiente',
      badgeClass: 'badge-orange',
      bg: '#fff3e8',
      iconColor: '#f9a03f',
      icon: 'report'
    },
    {
      title: 'Ruta consultada',
      sub: 'Zona norte · ayer 10:32 AM',
      badge: 'Activa',
      badgeClass: 'badge-green',
      bg: '#e8f7ef',
      iconColor: '#3aad6f',
      icon: 'map'
    },
    {
      title: 'Guía revisada',
      sub: 'Reciclaje doméstico · hace 3 días',
      badge: 'Info',
      badgeClass: 'badge-blue',
      bg: '#e6f6fc',
      iconColor: '#4ac2e8',
      icon: 'info'
    }
  ];

  activeNav = 'inicio';

  setActiveNav(nav: string): void {
    this.activeNav = nav;
  }
}