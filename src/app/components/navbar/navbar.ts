import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  supabaseService = inject(Supabase);
  private readonly i18n = inject(I18nService);
  private readonly translate = inject(TranslateService);
  user$ = this.supabaseService.user$.asObservable();
  isMenuOpen = signal(false);

  get currentLang() {
    return this.i18n.getCurrentLanguage();
  }

  toggleMenu() {
    this.isMenuOpen.update(open => !open);
  }

  closeMenu() {
    this.isMenuOpen.set(false);
  }

  logout() {
    this.supabaseService.logout();
    this.closeMenu();
  }

  setLanguage(lang: 'es' | 'en') {
    this.i18n.setLanguage(lang);
    this.translate.use(lang).subscribe();
  }
}
