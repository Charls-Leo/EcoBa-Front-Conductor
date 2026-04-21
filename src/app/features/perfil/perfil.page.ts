import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss']
})
export class PerfilPage implements OnInit {
  activeNav = 'perfil';
  usuario: any = null;
  isLoggedIn = false;

  constructor(
    private location: Location,
    private router: Router,
    private authService: AuthService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.cargarPerfil();
  }

  ionViewWillEnter(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    if (this.isLoggedIn) {
      this.usuario = this.authService.getUser();
    }
  }

  async cerrarSesion(): Promise<void> {
    this.authService.logout();
    this.isLoggedIn = false;
    this.usuario = null;

    const toast = await this.toastCtrl.create({
      message: 'Sesión cerrada correctamente',
      duration: 2000,
      color: 'medium',
      position: 'top'
    });
    await toast.present();
    this.router.navigate(['/home']);
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