import { DOCUMENT } from '@angular/common';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';

type SupportedLanguage = 'es' | 'en';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storageKey = 'gameroom_lang';
  private readonly doc = inject(DOCUMENT);
  private readonly langs: SupportedLanguage[] = ['es', 'en'];
  private readonly currentLangSignal = signal<SupportedLanguage>('en');

  readonly currentLang: Signal<SupportedLanguage> = computed(() => this.currentLangSignal());

  init(): SupportedLanguage {
    const resolved = this.resolveInitialLanguage();
    this.currentLangSignal.set(resolved);
    this.doc.documentElement.lang = resolved;
    return resolved;
  }

  setLanguage(lang: SupportedLanguage) {
    if (!this.langs.includes(lang)) {
      return;
    }

    this.currentLangSignal.set(lang);
    localStorage.setItem(this.storageKey, lang);
    this.doc.documentElement.lang = lang;
  }

  toggleLanguage() {
    this.setLanguage(this.currentLangSignal() === 'es' ? 'en' : 'es');
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLangSignal();
  }

  private resolveInitialLanguage(): SupportedLanguage {
    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'es' || stored === 'en') {
      return stored;
    }

    const browserLang = navigator.language?.toLowerCase() ?? 'en';
    return browserLang.startsWith('es') ? 'es' : 'en';
  }
}
