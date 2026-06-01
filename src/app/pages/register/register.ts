import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { InteractionDirective } from '../../directives/interaction-directive';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, InteractionDirective],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly authTimeoutMs = 3500;
  // permite letras, acentos, espacios y apostrofes en nombre/apellido
  private readonly namePattern = /^[A-Za-zÁÉÍÓÚáéíóúÑñ' -]+$/;

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
    // formulario reactivo con validaciones de alta de usuario
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30), Validators.pattern(this.namePattern)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30), Validators.pattern(this.namePattern)]],
      age: ['', [Validators.required, Validators.min(18), Validators.max(99)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    });

    // si ya hay sesion abierta, no tiene sentido quedarse en register
    this.handleAuthenticatedUserOnRegister();
  }

  async onRegister() {
    // evita doble submit mientras se registra
    if (this.loading) {
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    try {
      const { email, password, firstName, lastName, age } = this.registerForm.value;
      const parsedAge = Number(age);

      const { data, error } = await this.withAuthTimeout(
        this.supabaseService.signUp(email, password, firstName)
      );

      if (error) {
        this.openModal(this.mapAuthError(error.message));
        return;
      }

      if (!data.user) {
        this.openModal('No se pudo crear el usuario.');
        return;
      }

      const { error: profileError } = await this.supabaseService.saveUserProfile(
        data.user.id,
        firstName,
        lastName,
        parsedAge,
        email
      );

      if (profileError) {
        this.openModal('No se pudo guardar el perfil: ' + profileError.message);
        return;
      }

      if (!data.session) {
        // algunos providers crean usuario sin sesion, entonces logueamos manualmente
        const { error: loginError } = await this.withAuthTimeout(
          this.supabaseService.iniciarSesion(email, password)
        );

        if (loginError) {
          this.openModal('La cuenta se creó, pero no se pudo iniciar sesión: ' + this.mapAuthError(loginError.message));
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
    // limpia estado del modal para siguientes intentos
    this.showModal = false;
    this.modalMessage = '';
  }

  private openModal(message: string) {
    // modal unico para centralizar mensajes de error de registro
    this.modalMessage = message;
    this.showModal = true;
  }

  private withAuthTimeout<T>(operation: Promise<T>): Promise<T> {
    // timeout defensivo para no dejar bloqueada la pantalla de registro
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AUTH_TIMEOUT')), this.authTimeoutMs);
    });

    return Promise.race([operation, timeout]);
  }

  private async handleAuthenticatedUserOnRegister() {
    // guard de pagina: si ya esta autenticado redirige a home
    const user = await this.supabaseService.getCurrentUser();
    if (!user) {
      return;
    }

    this.router.navigate(['/home']);
  }

  private mapAuthError(message: string) {
    // mapea errores de supabase auth a textos claros para la ui
    const normalized = message.toLowerCase();

    if (normalized.includes('auth_timeout')) {
      return 'La operación está tardando más de lo esperado. Intentá nuevamente.';
    }

    if (normalized.includes('already registered')) {
      return 'Ese correo ya está registrado.';
    }

    if (normalized.includes('invalid login credentials')) {
      return 'No se pudo validar la cuenta recién creada. Iniciá sesión manualmente.';
    }

    if (normalized.includes('email not confirmed')) {
      return 'La cuenta requiere confirmación por correo.';
    }

    if (normalized.includes('rate limit')) {
      return 'Hay demasiados intentos. Esperá un momento y volvé a probar.';
    }

    return 'Error en Auth: ' + message;
  }
}



