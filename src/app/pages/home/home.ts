import { Component, DestroyRef, inject } from '@angular/core';
import { GameCard } from '../../components/game-card/game-card';
import { InteractionDirective } from '../../directives/interaction-directive';
import { Supabase } from '../../services/supabase';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, GameCard, InteractionDirective],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home {
  supabaseService = inject(Supabase);
  private destroyRef = inject(DestroyRef);
  // usuario actual para usar en el html con | async
  user$: Observable<any> = this.supabaseService.user$.asObservable();
  // nombre que se muestra en la pantalla de home
  displayName = '';

  // escucha cambios de login/logout y actualiza el nombre visible
  constructor() {
    this.supabaseService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (!user) {
          this.displayName = '';
          return;
        }

        this.loadDisplayName(user);
      });
  }

  // arma el nombre visible: primero uno rapido, luego el de la tabla profiles si existe
  private async loadDisplayName(user: any) {
    const fallbackName = user.user_metadata?.firstName || 'Usuario';
    this.displayName = fallbackName;

    const { data } = await this.supabaseService.getUserProfile(user.id);
    if (data?.first_name) {
      this.displayName = data.first_name;
    }
  }

  // delega el cierre de sesion al servicio global
  logout() {
    this.supabaseService.logout();
  }
}
