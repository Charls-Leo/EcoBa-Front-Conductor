import { Component, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class TabsPage implements OnDestroy {
  activeTab = '';

  private destroy$ = new Subject<void>();

  constructor(private router: Router, private authService: AuthService) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event) => {
      const navEnd = event as NavigationEnd;
      if (navEnd.url.includes('/perfil')) {
        this.activeTab = 'perfil';
      } else {
        this.activeTab = '';
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goToPerfil() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/tabs/perfil']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
