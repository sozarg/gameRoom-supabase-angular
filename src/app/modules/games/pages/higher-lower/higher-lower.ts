import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../../../services/supabase';
import { HigherLowerPlay } from '../../../../types/game.types';
import { DeckApi } from '../../../../services/deck-api';

interface GameCard {
  code: string;
  valueLabel: string;
  numericValue: number;
  suit: string;
  image: string;
}

interface HigherLowerSnapshot {
  score: number;
  correctGuesses: number;
  wrongGuesses: number;
  tiesCount: number;
  bestStreak: number;
  status: 'win' | 'loss';
  elapsedSeconds: number;
  history: HigherLowerPlay[];
}

@Component({
  selector: 'app-higher-lower',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './higher-lower.html',
  styleUrls: ['./higher-lower.css'],
})
export class HigherLower implements OnInit {
  private readonly supabase = inject(Supabase);
  private readonly deckApi = inject(DeckApi);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly maxLives = 3;
  private readonly maxTurns = 30;
  private readonly apiTimeoutMs = 1500;
  private localDeck: GameCard[] = [];
  private remoteDeckId: string | null = null;

  currentCard: GameCard | null = null;
  drawnCard: GameCard | null = null;

  score = 0;
  correctGuesses = 0;
  wrongGuesses = 0;
  tiesCount = 0;
  currentStreak = 0;
  bestStreak = 0;
  turnsPlayed = 0;

  gameOver = false;
  loading = false;
  initializing = false;
  drawingCard = false;
  savingResult = false;
  mensaje = '';
  status: 'win' | 'loss' | null = null;
  deckSource: 'api' | 'local' = 'local';
  remainingCards = 0;

  startTime = 0;
  elapsedSeconds = 0;
  history: HigherLowerPlay[] = [];

  ngOnInit() {
    this.startGame();
  }

  get livesLeft() {
    return this.maxLives - this.wrongGuesses;
  }

  async startGame() {
    // reinicia estado completo e intenta preparar un mazo nuevo
    this.zone.run(() => {
      this.initializing = true;
      this.loading = true;
      this.drawingCard = false;
      this.gameOver = false;
      this.status = null;
      this.score = 0;
      this.correctGuesses = 0;
      this.wrongGuesses = 0;
      this.tiesCount = 0;
      this.currentStreak = 0;
      this.bestStreak = 0;
      this.turnsPlayed = 0;
      this.history = [];
      this.mensaje = 'Elegí si la próxima carta será mayor o menor.';
      this.remoteDeckId = null;
      this.deckSource = 'local';
      this.remainingCards = 0;
      this.localDeck = [];
      this.currentCard = null;
      this.drawnCard = null;

      this.startTime = Date.now();
      this.elapsedSeconds = 0;
      // repinta estado inicial de la ronda al instante
      this.cdr.detectChanges();
    });

    try {
      await this.initializeDeck();
      const firstCard = await this.drawNextCard();
      if (!firstCard) {
        this.zone.run(() => {
          this.gameOver = true;
          this.status = 'loss';
          this.mensaje = 'No se pudo iniciar el mazo. Reinicia la partida.';
          // muestra falla de inicio del mazo sin esperar otro ciclo
          this.cdr.detectChanges();
        });
        return;
      }

      this.zone.run(() => {
        this.currentCard = firstCard;
        // repinta primera carta disponible en pantalla
        this.cdr.detectChanges();
      });
    } finally {
      this.zone.run(() => {
        this.initializing = false;
        this.loading = false;
        // actualiza fin de inicializacion y habilita botones
        this.cdr.detectChanges();
      });
    }
  }

  async guess(type: 'mayor' | 'menor') {
    // valida estado de ui y procesa una jugada
    if (this.loading || this.drawingCard || this.gameOver || !this.currentCard) {
      return;
    }

    this.drawingCard = true;
    // bloquea botones mientras se procesa la jugada actual
    this.cdr.detectChanges();
    try {
      const nextCard = await this.drawNextCard();
      if (!nextCard) {
        this.status = 'win';
        this.gameOver = true;
        this.mensaje = 'Completaste el mazo. Ganaste.';
        await this.guardarResultado(this.crearSnapshotResultado('win'));
        // repinta cierre de partida por mazo terminado
        this.cdr.detectChanges();
        return;
      }

      this.drawnCard = nextCard;
      this.turnsPlayed += 1;

    // empate: no suma ni resta puntos, pero consume turno
    if (nextCard.numericValue === this.currentCard.numericValue) {
      this.tiesCount += 1;
      this.currentStreak = 0;
      this.history.push({
        current_card_code: this.currentCard.code,
        drawn_card_code: nextCard.code,
        guess: type,
        outcome: 'tie',
        score_delta: 0,
      });
      this.currentCard = nextCard;
      this.mensaje = `Empate (${nextCard.valueLabel}). Sigue la partida.`;
      await this.finalizarSiLlegoAlLimiteDeTurnos();
      return;
    }

    const isCorrect =
      (type === 'mayor' && nextCard.numericValue > this.currentCard.numericValue) ||
      (type === 'menor' && nextCard.numericValue < this.currentCard.numericValue);

    // acierto: suma puntaje y mejora racha
    if (isCorrect) {
      this.correctGuesses += 1;
      this.score += 5;
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
      this.history.push({
        current_card_code: this.currentCard.code,
        drawn_card_code: nextCard.code,
        guess: type,
        outcome: 'correct',
        score_delta: 5,
      });
      this.currentCard = nextCard;
      this.mensaje = 'Acierto. Sigue jugando.';

      await this.finalizarSiLlegoAlLimiteDeTurnos();
      return;
    }

    // error: resta puntaje y pierde vida
    this.wrongGuesses += 1;
    const scoreAntesDelError = this.score;
    this.score = Math.max(0, this.score - 2);
    const scoreDelta = this.score - scoreAntesDelError;
    this.currentStreak = 0;
    this.history.push({
      current_card_code: this.currentCard.code,
      drawn_card_code: nextCard.code,
      guess: type,
      outcome: 'wrong',
      score_delta: scoreDelta,
    });
    this.currentCard = nextCard;

    if (this.wrongGuesses >= this.maxLives) {
      this.status = 'loss';
      this.gameOver = true;
      this.mensaje = `Perdiste: te quedaste sin vidas. Salió ${nextCard.valueLabel}.`;
      await this.guardarResultado(this.crearSnapshotResultado('loss'));
    } else {
      this.mensaje = `Fallaste: salió ${nextCard.valueLabel}. Te quedan ${this.livesLeft} vidas.`;
      await this.finalizarSiLlegoAlLimiteDeTurnos();
    }
    } finally {
      this.drawingCard = false;
      // vuelve a habilitar interaccion al terminar la jugada
      this.cdr.detectChanges();
    }
  }

  private async finalizarSiLlegoAlLimiteDeTurnos() {
    // condicion de victoria por rondas jugadas
    if (this.gameOver || this.turnsPlayed < this.maxTurns) {
      return;
    }

    this.status = 'win';
    this.gameOver = true;
    this.mensaje = 'Completaste la ronda. Ganaste.';
    await this.guardarResultado(this.crearSnapshotResultado('win'));
  }

  private crearSnapshotResultado(status: 'win' | 'loss'): HigherLowerSnapshot {
    // captura estado final para persistencia de ranking
    return {
      score: this.score,
      correctGuesses: this.correctGuesses,
      wrongGuesses: this.wrongGuesses,
      tiesCount: this.tiesCount,
      bestStreak: this.bestStreak,
      status,
      elapsedSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      history: [...this.history],
    };
  }

  private async guardarResultado(snapshot: HigherLowerSnapshot) {
    // persiste resultado solo si hay usuario logueado
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }
    this.elapsedSeconds = snapshot.elapsedSeconds;

    this.savingResult = true;
    try {
      await this.supabase.saveHigherLowerResult({
        user_id: user.id,
        score: snapshot.score,
        correct_guesses: snapshot.correctGuesses,
        wrong_guesses: snapshot.wrongGuesses,
        ties_count: snapshot.tiesCount,
        best_streak: snapshot.bestStreak,
        status: snapshot.status,
        duration_seconds: snapshot.elapsedSeconds,
        history: snapshot.history,
        finished_at: new Date().toISOString(),
      });
    } finally {
      this.savingResult = false;
    }
  }

  private async initializeDeck() {
    // intenta usar api remota y cae a mazo local si falla
    try {
      const response = await this.withTimeout(this.deckApi.createShuffledDeck(), this.apiTimeoutMs);
      if (!response.success || !response.deck_id) {
        throw new Error('No se pudo crear mazo remoto.');
      }

      this.remoteDeckId = response.deck_id;
      this.remainingCards = response.remaining;
      this.deckSource = 'api';
    } catch {
      this.deckSource = 'local';
      this.remoteDeckId = null;
      this.localDeck = this.createLocalDeck();
      this.shuffleLocalDeck(this.localDeck);
      this.remainingCards = this.localDeck.length;
      this.mensaje = 'Usando mazo local de respaldo.';
    }
  }

  private async drawNextCard(): Promise<GameCard | null> {
    // roba de api remota y hace fallback a mazo local ante error
    if (this.deckSource === 'api' && this.remoteDeckId) {
      try {
        const response = await this.withTimeout(
          this.deckApi.drawCards(this.remoteDeckId, 1),
          this.apiTimeoutMs
        );
        if (!response.success || !response.cards?.length) {
          return null;
        }

        this.remainingCards = response.remaining;
        return this.mapRemoteCard(response.cards[0]);
      } catch {
        this.deckSource = 'local';
        this.localDeck = this.createLocalDeck();
        this.shuffleLocalDeck(this.localDeck);
        this.remainingCards = this.localDeck.length;
      }
    }

    const card = this.localDeck.pop() ?? null;
    this.remainingCards = this.localDeck.length;
    return card;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    // timeout defensivo para no frenar la partida por red lenta
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('API_TIMEOUT')), timeoutMs);
    });
    return Promise.race([promise, timeout]);
  }

  private mapRemoteCard(card: { code: string; value: string; suit: string; image: string }): GameCard {
    return {
      code: card.code,
      valueLabel: card.value,
      numericValue: this.toNumericValue(card.value),
      suit: card.suit,
      image: card.image,
    };
  }

  private createLocalDeck(): GameCard[] {
    const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
    const values = ['ACE', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING'];
    const deck: GameCard[] = [];

    for (const suit of suits) {
      for (const value of values) {
        const code = this.toCardCode(value, suit);
        deck.push({
          code,
          valueLabel: value,
          numericValue: this.toNumericValue(value),
          suit,
          image: '',
        });
      }
    }

    return deck;
  }

  private shuffleLocalDeck(deck: GameCard[]) {
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  private toCardCode(value: string, suit: string) {
    const valueMap: Record<string, string> = {
      ACE: 'A',
      JACK: 'J',
      QUEEN: 'Q',
      KING: 'K',
    };
    const suitMap: Record<string, string> = {
      HEARTS: 'H',
      DIAMONDS: 'D',
      CLUBS: 'C',
      SPADES: 'S',
    };
    return `${valueMap[value] ?? value}${suitMap[suit] ?? 'X'}`;
  }

  private toNumericValue(value: string): number {
    if (value === 'ACE') return 1;
    if (value === 'JACK') return 11;
    if (value === 'QUEEN') return 12;
    if (value === 'KING') return 13;
    return Number(value);
  }

}
