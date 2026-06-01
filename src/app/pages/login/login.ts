import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { InteractionDirective } from '../../directives/interaction-directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, InteractionDirective],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authTimeoutMs = 3500;

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
    // formulario reactivo con reglas minimas para validar antes de pedir auth
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    });
  }

  async onSubmit() {
    // evita doble submit mientras hay un intento en curso
    if (this.loading) {
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    try {
      const { email, password } = this.loginForm.value;
      // si auth demora demasiado mostramos error controlado
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
    // limpia estado del modal para reusarlo en el proximo error
    this.showModal = false;
    this.modalMessage = '';
  }

  private openModal(message: string) {
    // modal unico para centralizar mensajes de error de auth
    this.modalMessage = message;
    this.showModal = true;
  }

  private withAuthTimeout<T>(operation: Promise<T>): Promise<T> {
    // timeout defensivo para no dejar la ui esperando indefinidamente
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AUTH_TIMEOUT')), this.authTimeoutMs);
    });

    return Promise.race([operation, timeout]);
  }

  private mapLoginError(message: string) {
    // traduce errores tecnicos de auth a mensajes amigables para el usuario
    const normalized = message.toLowerCase();

    if (normalized.includes('auth_timeout')) {
      return 'La validación está tardando más de lo esperado. Intenta nuevamente.';
    }

    if (normalized.includes('invalid login credentials')) {
      return 'Credenciales inválidas. Revisa correo y contraseña.';
    }

    if (normalized.includes('email not confirmed')) {
      return 'La cuenta requiere confirmación de correo.';
    }

    if (normalized.includes('rate limit')) {
      return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
    }

    return 'No se pudo iniciar sesión en este momento. Reintenta.';
  }
}
