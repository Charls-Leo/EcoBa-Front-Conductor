import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage implements OnDestroy {
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  private destroy$ = new Subject<void>();

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    remember: [false]
  });

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastCtrl: ToastController
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!field && field.invalid && field.touched;
  }

  async submit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (response) => {
          this.isLoading = false;
          if (response.ok) {
            const toast = await this.toastCtrl.create({
              message: `¡Bienvenido, ${response.usuario.nombre}!`,
              duration: 2000,
              color: 'success',
              position: 'top'
            });
            await toast.present();
            this.router.navigate(['/home']);
          }
        },
        error: async (err) => {
          this.isLoading = false;
          const mensaje = err.error?.error || 'Error al conectar con el servidor';
          this.errorMessage = mensaje;

          const toast = await this.toastCtrl.create({
            message: mensaje,
            duration: 3000,
            color: 'danger',
            position: 'top'
          });
          await toast.present();
        }
      });
  }

  goToRegister(): void {
    this.router.navigate(['/registro']);
  }
}