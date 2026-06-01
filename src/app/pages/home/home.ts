import { Component, DestroyRef, inject } from '@angular/core';
import { GameCard } from '../../components/game-card/game-card';
import { InteractionDirective } from '../../directives/interaction-directive';
import { Supabase } from '../../services/supabase';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, GameCard, InteractionDirective, TranslateModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home {
  supabaseService = inject(Supabase);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = inject(TranslateService);

  user$: Observable<any> = this.supabaseService.user$.asObservable();
  displayName = '';

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

  private async loadDisplayName(user: any) {
    const fallbackName = user.user_metadata?.firstName || this.t.instant('common.guest');
    this.displayName = fallbackName;

    const { data } = await this.supabaseService.getUserProfile(user.id);
    if (data?.first_name) {
      this.displayName = data.first_name;
    }
  }

  logout() {
    this.supabaseService.logout();
  }
}
