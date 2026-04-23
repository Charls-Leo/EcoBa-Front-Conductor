import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss']
})
export class RegistroPage implements OnDestroy {
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  private destroy$ = new Subject<void>();

  registerForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]]
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
    const field = this.registerForm.get(fieldName);
    return !!field && field.invalid && field.touched;
  }

  async submit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formValue = this.registerForm.value;

    this.authService.register({
      email: formValue.email,
      password: formValue.password,
      nombre: formValue.nombre,
      apellido: formValue.apellido
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (response) => {
          this.isLoading = false;
          if (response.ok) {
            const toast = await this.toastCtrl.create({
              message: '¡Cuenta creada exitosamente! Inicia sesión.',
              duration: 3000,
              color: 'success',
              position: 'top'
            });
            await toast.present();
            this.router.navigate(['/login']);
          }
        },
        error: async (err) => {
          this.isLoading = false;
          const mensaje = err.error?.error || 'Error al registrar usuario';
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

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}