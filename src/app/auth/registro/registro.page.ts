import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss']
})
export class RegistroPage {
  showPassword = false;

  registerForm: FormGroup = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    document: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!field && field.invalid && field.touched;
  }

  submit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const formValue = this.registerForm.value;

    this.authService.register({
      name: formValue.fullName,
      email: formValue.email,
      document: formValue.document
    });

    this.router.navigate(['/inicio']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}