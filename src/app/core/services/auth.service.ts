import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'ecobahia_driver_auth';
  private readonly USER_KEY = 'ecobahia_driver_user';

  isLoggedIn(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  login(userData?: any): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');

    if (userData) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
    }
  }

  register(userData: any): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
    localStorage.setItem(this.STORAGE_KEY, 'true');
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  getUser(): any | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }
}