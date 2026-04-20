import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss']
})
export class OnboardingPage {
  current = 0;

  slides = [
    {
      step: 'Paso 1',
      title: 'Reporta incidencias',
      text: 'Informa problemas relacionados con residuos o puntos que necesiten atención para ayudar a mantener la ciudad limpia.'
    },
    {
      step: 'Paso 2',
      title: 'Consulta rutas y recorridos',
      text: 'Visualiza información útil sobre recorridos o procesos de recolección de manera clara y organizada.'
    },
    {
      step: 'Paso 3',
      title: 'Gestiona todo en un solo lugar',
      text: 'Accede a una experiencia simple y moderna para conocer, consultar y usar mejor los servicios de EcoBahía.'
    }
  ];

  constructor(private router: Router) {}

  goTo(index: number): void {
    this.current = index;
  }

  nextSlide(): void {
    if (this.current < this.slides.length - 1) {
      this.current++;
    } else {
      this.goHome();
    }
  }

  skipToHome(): void {
    this.goHome();
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  getTrackTransform(): string {
    return `translateX(-${this.current * 100}%)`;
  }

  isLastSlide(): boolean {
    return this.current === this.slides.length - 1;
  }
}