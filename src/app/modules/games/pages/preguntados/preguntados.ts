import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CountriesApi, TriviaCountry } from '../../../../services/countries-api';
import { Supabase } from '../../../../services/supabase';
import { PreguntadosQuestionPlay, PreguntadosResult } from '../../../../types/game.types';

interface RoundQuestion {
  round: number;
  country: TriviaCountry;
  options: string[];
}

@Component({
  selector: 'app-preguntados',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './preguntados.html',
  styleUrls: ['./preguntados.css'],
})
export class Preguntados implements OnInit {
  private readonly countriesApi = inject(CountriesApi);
  private readonly supabase = inject(Supabase);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly maxLives = 3;
  private readonly totalRounds = 10;
  private readonly minPoolSize = 12;

  countriesPool: TriviaCountry[] = [];
  usedCountryCodes = new Set<string>();
  currentQuestion: RoundQuestion | null = null;
  roundsPlayed = 0;
  score = 0;
  correctAnswers = 0;
  wrongAnswers = 0;
  livesLost = 0;
  initializing = false;
  loading = false;
  answerLocked = false;
  savingResult = false;
  gameOver = false;
  status: 'win' | 'loss' | null = null;
  errorCarga = '';
  mensaje = 'Elegí el país correcto según la bandera.';
  messageTone: 'neutral' | 'success' | 'error' = 'neutral';
  lastAnswerCorrect: boolean | null = null;
  startTime = 0;
  elapsedSeconds = 0;
  questionHistory: PreguntadosQuestionPlay[] = [];
  selectedOption = '';
  lastCorrectCountryName = '';

  ngOnInit() {
    void this.startGame();
  }

  get livesLeft() {
    return this.maxLives - this.livesLost;
  }

  getName(country: TriviaCountry) {
    return this.countriesApi.getLocalizedName(country);
  }

  async startGame() {
    this.initializing = true;
    this.loading = true;
    this.gameOver = false;
    this.status = null;
    this.errorCarga = '';
    this.score = 0;
    this.correctAnswers = 0;
    this.wrongAnswers = 0;
    this.livesLost = 0;
    this.roundsPlayed = 0;
    this.currentQuestion = null;
    this.usedCountryCodes = new Set<string>();
    this.questionHistory = [];
    this.selectedOption = '';
    this.lastCorrectCountryName = '';
    this.answerLocked = false;
    this.lastAnswerCorrect = null;
    this.mensaje = 'Elegí el país correcto según la bandera.';
    this.messageTone = 'neutral';
    this.startTime = Date.now();
    this.elapsedSeconds = 0;

    try {
      const countries = await this.countriesApi.getCountries();
      if (!countries.length || countries.length < this.minPoolSize) throw new Error('POOL_TOO_SMALL');
      this.countriesPool = countries;
      if (this.countriesApi.lastSource === 'fallback') this.mensaje = 'Modo respaldo activo: banderas locales.';

      this.currentQuestion = this.buildNextQuestion();
      if (!this.currentQuestion) throw new Error('NO_QUESTION');
    } catch {
      this.errorCarga = 'No se pudieron cargar las banderas. Reintenta.';
    } finally {
      this.initializing = false;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async answer(optionName: string) {
    if (this.loading || this.initializing || this.answerLocked || this.gameOver || !this.currentQuestion) return;

    this.answerLocked = true;
    this.selectedOption = optionName;

    const correctName = this.getName(this.currentQuestion.country);
    const isCorrect = optionName === correctName;
    this.lastCorrectCountryName = correctName;
    this.lastAnswerCorrect = isCorrect;
    let scoreDelta = 0;

    if (isCorrect) {
      scoreDelta = 5;
      this.score += scoreDelta;
      this.correctAnswers += 1;
      this.mensaje = '¡Correcto!';
      this.messageTone = 'success';
    } else {
      scoreDelta = this.score > 0 ? -Math.min(2, this.score) : 0;
      this.score = Math.max(0, this.score - 2);
      this.wrongAnswers += 1;
      this.livesLost += 1;
      this.mensaje = '¡Incorrecto!';
      this.messageTone = 'error';
    }

    this.questionHistory.push({
      round: this.currentQuestion.round,
      country_code: this.currentQuestion.country.code,
      country_name: correctName,
      selected_option: optionName,
      options: [...this.currentQuestion.options],
      is_correct: isCorrect,
      score_delta: scoreDelta,
    });

    this.roundsPlayed += 1;
    this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    setTimeout(() => {
      const endedByLives = this.livesLost >= this.maxLives;
      const endedByRounds = this.roundsPlayed >= this.totalRounds;
      if (endedByLives || endedByRounds) {
        this.gameOver = true;
        this.status = endedByLives ? 'loss' : 'win';
        this.mensaje = endedByLives ? 'Perdiste: te quedaste sin vidas.' : 'Ronda completada: respondiste todas las preguntas.';
        this.messageTone = endedByLives ? 'error' : 'success';
        void this.saveResult(this.createSnapshotResult(this.status));
        this.cdr.detectChanges();
        return;
      }

      this.selectedOption = '';
      this.currentQuestion = this.buildNextQuestion();
      this.answerLocked = false;
      this.lastAnswerCorrect = null;
      this.messageTone = 'neutral';
      if (!this.currentQuestion) {
        this.gameOver = true;
        this.status = 'win';
        this.mensaje = 'No hay más países disponibles. Ganaste la ronda.';
        this.messageTone = 'success';
        void this.saveResult(this.createSnapshotResult('win'));
      }
      this.cdr.detectChanges();
    }, 2000);
  }

  getOptionClass(optionName: string) {
    if (!this.answerLocked || !this.currentQuestion) return '';
    if (optionName === this.getName(this.currentQuestion.country)) return 'option-correct';
    if (this.lastAnswerCorrect === false) return 'option-wrong';
    return '';
  }

  private buildNextQuestion(): RoundQuestion | null {
    const available = this.countriesPool.filter((country) => !this.usedCountryCodes.has(country.code));
    if (available.length < 3) return null;

    const correctCountry = available[Math.floor(Math.random() * available.length)];
    this.usedCountryCodes.add(correctCountry.code);

    const distractorPool = this.countriesPool.filter(
      (country) => country.code !== correctCountry.code && this.getName(country) !== this.getName(correctCountry)
    );
    const distractors = this.getRandomDistinctCountries(distractorPool, 2);
    if (distractors.length < 2) return null;

    const options = this.shuffle([
      this.getName(correctCountry),
      this.getName(distractors[0]),
      this.getName(distractors[1]),
    ]);

    return { round: this.roundsPlayed + 1, country: correctCountry, options };
  }

  private getRandomDistinctCountries(pool: TriviaCountry[], amount: number) {
    if (!pool.length) return [];
    const clone = [...pool];
    this.shuffle(clone);
    return clone.slice(0, amount);
  }

  private shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private createSnapshotResult(status: 'win' | 'loss'): PreguntadosResult {
    return {
      user_id: '',
      score: this.score,
      correct_answers: this.correctAnswers,
      wrong_answers: this.wrongAnswers,
      lives_lost: this.livesLost,
      total_questions: this.roundsPlayed,
      status,
      duration_seconds: this.elapsedSeconds,
      questions_played: [...this.questionHistory],
      finished_at: new Date().toISOString(),
    };
  }

  private async saveResult(snapshot: PreguntadosResult) {
    const user = await this.supabase.getCurrentUser();
    if (!user) return;

    this.savingResult = true;
    try {
      await this.supabase.savePreguntadosResult({ ...snapshot, user_id: user.id });
    } finally {
      this.savingResult = false;
      this.cdr.detectChanges();
    }
  }
}

