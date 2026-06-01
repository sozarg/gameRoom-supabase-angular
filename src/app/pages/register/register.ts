import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { InteractionDirective } from '../../directives/interaction-directive';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, InteractionDirective, TranslateModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly authTimeoutMs = 3500;
  private readonly namePattern = /^[A-Za-zÁÉÍÓÚáéíóúÑñ' -]+$/;
  private readonly t = inject(TranslateService);

  registerForm: FormGroup;
  errorMessage: string | null = null;
  loading = false;
  showModal = false;
  modalMessage = '';

  constructor(
    private fb: FormBuilder,
    private supabaseService: Supabase,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30), Validators.pattern(this.namePattern)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30), Validators.pattern(this.namePattern)]],
      age: ['', [Validators.required, Validators.min(18), Validators.max(99)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    });

    this.handleAuthenticatedUserOnRegister();
  }

  async onRegister() {
    if (this.loading) return;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    try {
      const { email, password, firstName, lastName, age } = this.registerForm.value;
      const parsedAge = Number(age);

      const { data, error } = await this.withAuthTimeout(this.supabaseService.signUp(email, password, firstName));

      if (error) {
        this.openModal(this.mapAuthError(error.message));
        return;
      }

      if (!data.user) {
        this.openModal(this.t.instant('auth.signup_user_error'));
        return;
      }

      const { error: profileError } = await this.supabaseService.saveUserProfile(data.user.id, firstName, lastName, parsedAge, email);

      if (profileError) {
        this.openModal(this.t.instant('auth.signup_profile_error', { message: profileError.message }));
        return;
      }

      if (!data.session) {
        const { error: loginError } = await this.withAuthTimeout(this.supabaseService.iniciarSesion(email, password));

        if (loginError) {
          this.openModal(this.t.instant('auth.signup_login_error', { message: this.mapAuthError(loginError.message) }));
          return;
        }
      }

      this.router.navigate(['/home']);
    } catch (error: any) {
      this.openModal(this.mapAuthError(error?.message ?? ''));
    } finally {
      this.loading = false;
    }
  }

  closeModal() {
    this.showModal = false;
    this.modalMessage = '';
  }

  private openModal(message: string) {
    this.modalMessage = message;
    this.showModal = true;
  }

  private withAuthTimeout<T>(operation: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AUTH_TIMEOUT')), this.authTimeoutMs);
    });

    return Promise.race([operation, timeout]);
  }

  private async handleAuthenticatedUserOnRegister() {
    const user = await this.supabaseService.getCurrentUser();
    if (!user) return;
    this.router.navigate(['/home']);
  }

  private mapAuthError(message: string) {
    const normalized = message.toLowerCase();

    if (normalized.includes('auth_timeout')) return this.t.instant('auth.signup_timeout');
    if (normalized.includes('already registered')) return this.t.instant('auth.signup_email_exists');
    if (normalized.includes('invalid login credentials')) return this.t.instant('auth.signup_validate_error');
    if (normalized.includes('email not confirmed')) return this.t.instant('auth.email_confirm');
    if (normalized.includes('rate limit')) return this.t.instant('auth.rate_limit');

    return this.t.instant('auth.signup_auth_error', { message });
  }
}
