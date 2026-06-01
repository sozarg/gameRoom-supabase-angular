import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { InteractionDirective } from '../../directives/interaction-directive';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, InteractionDirective, TranslateModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authTimeoutMs = 3500;
  private readonly t = inject(TranslateService);

  loginForm: FormGroup;
  errorMessage: string | null = null;
  loading = false;
  showModal = false;
  modalMessage = '';

  constructor(
    private fb: FormBuilder,
    private supabaseService: Supabase,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    });
  }

  completeQuickAccess(profile: string) {
    const credentials: Record<string, { email: string; password: string }> = {
      admin: { email: 'admin@sala.com', password: 'passwordadmin' },
      usuario: { email: 'usuario@sala.com', password: 'passworduser' },
      invitado: { email: 'invitado@sala.com', password: 'passwordguest' },
    };

    const account = credentials[profile];
    if (!account) return;

    this.loginForm.patchValue(account);
    this.errorMessage = null;
  }

  async onSubmit() {
    if (this.loading) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    try {
      const { email, password } = this.loginForm.value;
      const { error } = await this.withAuthTimeout(this.supabaseService.iniciarSesion(email, password));

      if (error) {
        this.openModal(this.mapLoginError(error.message));
        return;
      }

      this.router.navigate(['/home']);
    } catch (error: any) {
      this.openModal(this.mapLoginError(error?.message ?? ''));
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

  private mapLoginError(message: string) {
    const normalized = message.toLowerCase();

    if (normalized.includes('auth_timeout')) return this.t.instant('auth.timeout');
    if (normalized.includes('invalid login credentials')) return this.t.instant('auth.invalid_credentials');
    if (normalized.includes('email not confirmed')) return this.t.instant('auth.email_confirm');
    if (normalized.includes('rate limit')) return this.t.instant('auth.rate_limit');

    return this.t.instant('auth.generic_login_error');
  }
}
