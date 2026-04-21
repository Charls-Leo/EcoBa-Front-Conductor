import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class TabsPage {
  activeTab = '';

  constructor(private router: Router, private authService: AuthService) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url.includes('/perfil')) {
        this.activeTab = 'perfil';
      } else {
        this.activeTab = '';
      }
    });
  }

  goToPerfil() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/tabs/perfil']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}

