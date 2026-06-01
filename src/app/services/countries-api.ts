import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

interface RestCountry {
  cca2?: string;
  flags?: {
    png?: string;
  };
  name?: {
    common?: string;
  };
  translations?: {
    spa?: {
      common?: string;
    };
  };
}

export interface TriviaCountry {
  code: string;
  name: string;
  flag: string;
}

@Injectable({
  providedIn: 'root',
})
export class CountriesApi {
  private readonly http = inject(HttpClient);
  private readonly endpoint =
    'https://restcountries.com/v3.1/independent?status=true&fields=name,translations,flags,cca2';
  private readonly requestTimeoutMs = 1500;
  private cachedCountries: TriviaCountry[] | null = null;
  // indica si se usaron banderas de api real o del respaldo local
  lastSource: 'api' | 'fallback' = 'api';
  private readonly fallbackCountries: TriviaCountry[] = [
    { code: 'AR', name: 'Argentina', flag: 'https://flagcdn.com/w320/ar.png' },
    { code: 'UY', name: 'Uruguay', flag: 'https://flagcdn.com/w320/uy.png' },
    { code: 'BR', name: 'Brasil', flag: 'https://flagcdn.com/w320/br.png' },
    { code: 'CL', name: 'Chile', flag: 'https://flagcdn.com/w320/cl.png' },
    { code: 'PE', name: 'Perú', flag: 'https://flagcdn.com/w320/pe.png' },
    { code: 'PY', name: 'Paraguay', flag: 'https://flagcdn.com/w320/py.png' },
    { code: 'BO', name: 'Bolivia', flag: 'https://flagcdn.com/w320/bo.png' },
    { code: 'CO', name: 'Colombia', flag: 'https://flagcdn.com/w320/co.png' },
    { code: 'VE', name: 'Venezuela', flag: 'https://flagcdn.com/w320/ve.png' },
    { code: 'EC', name: 'Ecuador', flag: 'https://flagcdn.com/w320/ec.png' },
    { code: 'MX', name: 'México', flag: 'https://flagcdn.com/w320/mx.png' },
    { code: 'US', name: 'Estados Unidos', flag: 'https://flagcdn.com/w320/us.png' },
    { code: 'CA', name: 'Canadá', flag: 'https://flagcdn.com/w320/ca.png' },
    { code: 'ES', name: 'España', flag: 'https://flagcdn.com/w320/es.png' },
    { code: 'FR', name: 'Francia', flag: 'https://flagcdn.com/w320/fr.png' },
    { code: 'DE', name: 'Alemania', flag: 'https://flagcdn.com/w320/de.png' },
    { code: 'IT', name: 'Italia', flag: 'https://flagcdn.com/w320/it.png' },
    { code: 'PT', name: 'Portugal', flag: 'https://flagcdn.com/w320/pt.png' },
    { code: 'GB', name: 'Reino Unido', flag: 'https://flagcdn.com/w320/gb.png' },
    { code: 'IE', name: 'Irlanda', flag: 'https://flagcdn.com/w320/ie.png' },
    { code: 'NL', name: 'Países Bajos', flag: 'https://flagcdn.com/w320/nl.png' },
    { code: 'BE', name: 'Bélgica', flag: 'https://flagcdn.com/w320/be.png' },
    { code: 'CH', name: 'Suiza', flag: 'https://flagcdn.com/w320/ch.png' },
    { code: 'AT', name: 'Austria', flag: 'https://flagcdn.com/w320/at.png' },
    { code: 'SE', name: 'Suecia', flag: 'https://flagcdn.com/w320/se.png' },
    { code: 'NO', name: 'Noruega', flag: 'https://flagcdn.com/w320/no.png' },
    { code: 'FI', name: 'Finlandia', flag: 'https://flagcdn.com/w320/fi.png' },
    { code: 'DK', name: 'Dinamarca', flag: 'https://flagcdn.com/w320/dk.png' },
    { code: 'PL', name: 'Polonia', flag: 'https://flagcdn.com/w320/pl.png' },
    { code: 'CZ', name: 'Chequia', flag: 'https://flagcdn.com/w320/cz.png' },
    { code: 'GR', name: 'Grecia', flag: 'https://flagcdn.com/w320/gr.png' },
    { code: 'TR', name: 'Turquía', flag: 'https://flagcdn.com/w320/tr.png' },
    { code: 'JP', name: 'Japón', flag: 'https://flagcdn.com/w320/jp.png' },
    { code: 'KR', name: 'Corea del Sur', flag: 'https://flagcdn.com/w320/kr.png' },
    { code: 'CN', name: 'China', flag: 'https://flagcdn.com/w320/cn.png' },
    { code: 'IN', name: 'India', flag: 'https://flagcdn.com/w320/in.png' },
    { code: 'AU', name: 'Australia', flag: 'https://flagcdn.com/w320/au.png' },
    { code: 'NZ', name: 'Nueva Zelanda', flag: 'https://flagcdn.com/w320/nz.png' },
    { code: 'ZA', name: 'Sudáfrica', flag: 'https://flagcdn.com/w320/za.png' },
    { code: 'EG', name: 'Egipto', flag: 'https://flagcdn.com/w320/eg.png' },
  ];

  async getCountries() {
    // cache simple para no pegarle a la api en cada nueva partida
    if (this.cachedCountries) {
      return this.cachedCountries;
    }

    try {
      // timeout corto para evitar que la pantalla quede colgada si la api demora
      const response = await firstValueFrom(
        this.http.get<RestCountry[]>(this.endpoint).pipe(timeout(this.requestTimeoutMs))
      );

      const seenNames = new Set<string>();
      const countries = (response ?? [])
        .map((country): TriviaCountry | null => {
          const code = (country.cca2 ?? '').trim().toUpperCase();
          const flag = (country.flags?.png ?? '').trim();
          const nameSpa = (country.translations?.spa?.common ?? '').trim();
          const nameCommon = (country.name?.common ?? '').trim();
          const name = nameSpa || nameCommon;

          if (!code || !flag || !name) {
            return null;
          }

          // evita paises repetidos cuando vienen variantes de nombre
          const dedupeName = name.toLocaleLowerCase('es-UY');
          if (seenNames.has(dedupeName)) {
            return null;
          }
          seenNames.add(dedupeName);

          return {
            code,
            name,
            flag,
          };
        })
        .filter((country): country is TriviaCountry => country !== null);

      if (!countries.length) {
        // forzamos fallback si la api responde vacia o inutilizable
        throw new Error('EMPTY_COUNTRIES');
      }

      this.lastSource = 'api';
      this.cachedCountries = countries;
      return countries;
    } catch (error) {
      // fallback para que preguntados siga funcionando aun sin api externa
      console.warn('[preguntados] fallback countries enabled', error);
      this.lastSource = 'fallback';
      this.cachedCountries = this.fallbackCountries;
      return this.fallbackCountries;
    }
  }
}
