import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'ecobahia_driver_theme';
  private readonly darkModeSubject = new BehaviorSubject<boolean>(false);

  readonly darkMode$ = this.darkModeSubject.asObservable();

  constructor() {
    // Siempre modo claro por defecto, a menos que el usuario haya guardado oscuro explícitamente
    const savedTheme = localStorage.getItem(this.storageKey);
    this.setDarkMode(savedTheme === 'dark', false);
  }

  get isDarkMode(): boolean {
    return this.darkModeSubject.value;
  }

  toggle(): void {
    this.setDarkMode(!this.isDarkMode);
  }

  setDarkMode(isDark: boolean, persist = true): void {
    this.darkModeSubject.next(isDark);
    document.body.classList.toggle('dark-theme', isDark);
    document.documentElement.classList.toggle('dark-theme', isDark);

    if (persist) {
      localStorage.setItem(this.storageKey, isDark ? 'dark' : 'light');
    }
  }
}
