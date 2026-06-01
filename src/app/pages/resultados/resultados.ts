import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from '../../services/supabase';

type RowBase = {
  user_id: string;
  score?: number;
  duration_seconds: number;
  finished_at: string;
};

type RowWithPlayer<T> = T & { player: string };

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './resultados.html',
  styleUrl: './resultados.css',
})
export class Resultados implements OnInit, OnDestroy {
  private readonly supabase = inject(Supabase);
  private readonly cdr = inject(ChangeDetectorRef);
  private resultsChannel: RealtimeChannel | null = null;
  // evita recargas superpuestas cuando llegan varios eventos realtime juntos
  private reloadInFlight = false;

  selectedGame: 'ahorcado' | 'mayor-menor' | 'preguntados' | 'escapa' = 'ahorcado';
  isAuthenticated = false;
  loading = true;
  error = '';

  hangman: RowWithPlayer<any>[] = [];
  higherLower: RowWithPlayer<any>[] = [];
  preguntados: RowWithPlayer<any>[] = [];
  escapeRoom: RowWithPlayer<any>[] = [];

  async ngOnInit() {
    // valida sesion antes de consultar rankings protegidos
    const user = await this.supabase.getCurrentUser();
    this.isAuthenticated = !!user;

    if (!this.isAuthenticated) {
      this.loading = false;
      // fuerza refresh para mostrar vista bloqueada inmediatamente
      queueMicrotask(() => this.cdr.detectChanges());
      return;
    }

    await this.loadRankings();
    this.subscribeRealtime();
  }

  ngOnDestroy() {
    // cierra canal realtime al salir de la pantalla
    if (this.resultsChannel) {
      this.supabase.removeChannel(this.resultsChannel);
      this.resultsChannel = null;
    }
  }

  private async loadRankings() {
    // lock para evitar race conditions entre recargas manuales y realtime
    if (this.reloadInFlight) return;
    this.reloadInFlight = true;
    this.loading = true;
    this.error = '';

    try {
      const [hangmanRes, higherRes, preguntadosRes, escapeRes] = await Promise.all([
        this.supabase.getHangmanTopResults(10),
        this.supabase.getHigherLowerTopResults(10),
        this.supabase.getPreguntadosTopResults(10),
        this.supabase.getEscapeRoomTopResults(10),
      ]);

      if (hangmanRes.error || higherRes.error || preguntadosRes.error || escapeRes.error) {
        throw new Error('No se pudieron cargar los resultados.');
      }

      const hangmanRows = (hangmanRes.data ?? []) as any[];
      const higherRows = (higherRes.data ?? []) as any[];
      const preguntadosRows = (preguntadosRes.data ?? []) as any[];
      const escapeRows = (escapeRes.data ?? []) as any[];

      const playerMap = await this.resolvePlayers([
        ...hangmanRows,
        ...higherRows,
        ...preguntadosRows,
        ...escapeRows,
      ]);

      this.hangman = hangmanRows.map((row) => ({ ...row, player: this.getPlayerName(row.user_id, playerMap) }));
      this.higherLower = higherRows.map((row) => ({ ...row, player: this.getPlayerName(row.user_id, playerMap) }));
      this.preguntados = preguntadosRows.map((row) => ({ ...row, player: this.getPlayerName(row.user_id, playerMap) }));
      this.escapeRoom = escapeRows.map((row) => ({ ...row, player: this.getPlayerName(row.user_id, playerMap) }));
    } catch {
      this.error = 'No se pudieron cargar los rankings en este momento.';
    } finally {
      this.loading = false;
      this.reloadInFlight = false;
      // refresca vista al terminar la carga (ok o error)
      queueMicrotask(() => this.cdr.detectChanges());
    }
  }

  private subscribeRealtime() {
    // refresca tablas cuando entra un resultado nuevo en cualquier juego
    this.resultsChannel = this.supabase.subscribeToResultsChanges(async () => {
      await this.loadRankings();
    });
  }

  private async resolvePlayers(rows: RowBase[]) {
    // resuelve ids de usuario a nombre para mostrar ranking legible
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const result = await this.supabase.getProfilesByIds(ids);

    if (result.error || !result.data) {
      return new Map<string, string>();
    }

    const map = new Map<string, string>();
    for (const profile of result.data as Array<{ id: string; first_name: string | null }>) {
      if (profile.first_name) {
        map.set(profile.id, profile.first_name);
      }
    }
    return map;
  }

  private getPlayerName(userId: string, map: Map<string, string>) {
    // fallback si no hay perfil: muestra identificador corto
    return map.get(userId) ?? `Jugador ${userId.slice(0, 6)}`;
  }

  rank(index: number) {
    // muestra ranking humano desde 1
    return index + 1;
  }

  podiumClass(index: number) {
    // pinta podio para top 3
    if (index === 0) return 'podium-gold';
    if (index === 1) return 'podium-silver';
    if (index === 2) return 'podium-bronze';
    return '';
  }

  setSelectedGame(game: 'ahorcado' | 'mayor-menor' | 'preguntados' | 'escapa') {
    // cambia la tabla activa sin recargar datos
    this.selectedGame = game;
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleString('es-UY');
  }

  formatTime(totalSeconds: number) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${minutes}:${rem.toString().padStart(2, '0')}`;
  }
}
