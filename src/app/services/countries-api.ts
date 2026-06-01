import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { I18nService } from './i18n.service';

interface RestCountry {
  cca2?: string;
  flags?: { png?: string };
  name?: { common?: string };
  translations?: { spa?: { common?: string } };
}

export interface TriviaCountry {
  code: string;
  names: { es: string; en: string };
  flag: string;
}

@Injectable({ providedIn: 'root' })
export class CountriesApi {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly endpoint = 'https://restcountries.com/v3.1/independent?status=true&fields=name,translations,flags,cca2';
  private readonly requestTimeoutMs = 1500;
  private cachedCountries: TriviaCountry[] | null = null;
  lastSource: 'api' | 'fallback' = 'api';

  private readonly fallbackCountries: TriviaCountry[] = [
    { code: 'AR', names: { es: 'Argentina', en: 'Argentina' }, flag: 'https://flagcdn.com/w320/ar.png' },
    { code: 'UY', names: { es: 'Uruguay', en: 'Uruguay' }, flag: 'https://flagcdn.com/w320/uy.png' },
    { code: 'BR', names: { es: 'Brasil', en: 'Brazil' }, flag: 'https://flagcdn.com/w320/br.png' },
    { code: 'CL', names: { es: 'Chile', en: 'Chile' }, flag: 'https://flagcdn.com/w320/cl.png' },
    { code: 'PE', names: { es: 'Perú', en: 'Peru' }, flag: 'https://flagcdn.com/w320/pe.png' },
    { code: 'MX', names: { es: 'México', en: 'Mexico' }, flag: 'https://flagcdn.com/w320/mx.png' },
    { code: 'US', names: { es: 'Estados Unidos', en: 'United States' }, flag: 'https://flagcdn.com/w320/us.png' },
    { code: 'CA', names: { es: 'Canadá', en: 'Canada' }, flag: 'https://flagcdn.com/w320/ca.png' },
    { code: 'ES', names: { es: 'España', en: 'Spain' }, flag: 'https://flagcdn.com/w320/es.png' },
    { code: 'FR', names: { es: 'Francia', en: 'France' }, flag: 'https://flagcdn.com/w320/fr.png' },
    { code: 'DE', names: { es: 'Alemania', en: 'Germany' }, flag: 'https://flagcdn.com/w320/de.png' },
    { code: 'IT', names: { es: 'Italia', en: 'Italy' }, flag: 'https://flagcdn.com/w320/it.png' },
    { code: 'GB', names: { es: 'Reino Unido', en: 'United Kingdom' }, flag: 'https://flagcdn.com/w320/gb.png' },
    { code: 'JP', names: { es: 'Japón', en: 'Japan' }, flag: 'https://flagcdn.com/w320/jp.png' },
    { code: 'AU', names: { es: 'Australia', en: 'Australia' }, flag: 'https://flagcdn.com/w320/au.png' }
  ];

  async getCountries() {
    if (this.cachedCountries) return this.cachedCountries;

    try {
      const response = await firstValueFrom(this.http.get<RestCountry[]>(this.endpoint).pipe(timeout(this.requestTimeoutMs)));

      const seenNames = new Set<string>();
      const countries = (response ?? [])
        .map((country): TriviaCountry | null => {
          const code = (country.cca2 ?? '').trim().toUpperCase();
          const flag = (country.flags?.png ?? '').trim();
          const nameEs = (country.translations?.spa?.common ?? country.name?.common ?? '').trim();
          const nameEn = (country.name?.common ?? '').trim();
          if (!code || !flag || !nameEs || !nameEn) return null;

          const dedupeName = `${nameEs.toLocaleLowerCase('es-UY')}::${nameEn.toLocaleLowerCase('en-US')}`;
          if (seenNames.has(dedupeName)) return null;
          seenNames.add(dedupeName);

          return { code, names: { es: nameEs, en: nameEn }, flag };
        })
        .filter((country): country is TriviaCountry => country !== null);

      if (!countries.length) throw new Error('EMPTY_COUNTRIES');

      this.lastSource = 'api';
      this.cachedCountries = countries;
      return countries;
    } catch (error) {
      console.warn('[preguntados] fallback countries enabled', error);
      this.lastSource = 'fallback';
      this.cachedCountries = this.fallbackCountries;
      return this.fallbackCountries;
    }
  }

  getLocalizedName(country: TriviaCountry) {
    const lang = this.i18n.getCurrentLanguage();
    return country.names[lang] ?? country.names.en;
  }
}
