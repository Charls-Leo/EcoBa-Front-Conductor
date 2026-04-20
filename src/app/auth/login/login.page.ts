import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {
  showPassword = false;

  loginForm: FormGroup = this.fb.group({
    user: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(4)]],
    remember: [false]
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
    const field = this.loginForm.get(fieldName);
    return !!field && field.invalid && field.touched;
  }

  submit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const formValue = this.loginForm.value;

    this.authService.login({
      name: 'Conductor',
      user: formValue.user
    });

    this.router.navigate(['/inicio']);
  }

  goToRegister(): void {
    this.router.navigate(['/registro']);
  }
}