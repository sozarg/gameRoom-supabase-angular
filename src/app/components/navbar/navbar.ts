import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  supabaseService = inject(Supabase);
  // observable del usuario actual para mostrar botones distintos en la barra (login/logout)
  user$ = this.supabaseService.user$.asObservable();
  // signal: estado local del componente (solo abre/cierra el menu)
  isMenuOpen = signal(false);

  // alterna menu cerrado/abierto en mobile
  toggleMenu() {
    this.isMenuOpen.update(open => !open);
  }

  // cierra el menu, por ejemplo al tocar un link
  closeMenu() {
    this.isMenuOpen.set(false);
  }

  // cierra sesion global y luego cierra el menu local
  logout() {
    this.supabaseService.logout();
    this.closeMenu();
  }
}
