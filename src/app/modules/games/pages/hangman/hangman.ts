import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../../../services/supabase';
import { HangmanResult } from '../../../../types/game.types';

@Component({
  selector: 'app-hangman',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './hangman.html',
  styleUrls: ['./hangman.css'],
})
export class Hangman implements OnInit {
  private readonly supabase = inject(Supabase);

  private readonly wordBank = [
    'MURCIELAGO',
    'PROGRAMACION',
    'ANGULAR',
    'SUPABASE',
    'FACULTAD',
    'JAVASCRIPT',
    'COMPUTADORA',
    'TECLADO',
    'MONITOR',
    'ALGORITMO',
    'VARIABLE',
    'FUNCION',
    'OBJETO',
    'INTERFAZ',
    'SERVIDOR',
    'CLIENTE',
    'BASEDEDATOS',
    'DESARROLLO',
    'INGENIERIA',
    'SISTEMA',
    'ELECTRONICA',
    'MATEMATICA',
    'FISICA',
    'QUIMICA',
    'BIOLOGIA',
    'ASTRONOMIA',
    'GALAXIA',
    'PLANETA',
    'SATELITE',
    'UNIVERSO',
    'MONTANA',
    'DESIERTO',
    'BOSQUE',
    'OCEANO',
    'TORMENTA',
    'RELAMPAGO',
    'HURACAN',
    'PRIMAVERA',
    'VERANO',
    'OTONIO',
    'INVIERNO',
    'BICICLETA',
    'AEROPUERTO',
    'CAMINATA',
    'ENTRENAMIENTO',
    'COMPETENCIA',
    'ESTRATEGIA',
    'PACIENCIA',
    'DESAFIO',
    'VICTORIA',
    'DERROTA',
    'APRENDIZAJE',
    'CREATIVIDAD',
    'PERSISTENCIA',
    'COMUNICACION',
    'COLABORACION',
    'RESPONSABILIDAD',
    'CURIOSIDAD',
    'DISCIPLINA',
    'CONCENTRACION',
    'IMAGINACION',
    'TECNICO',
    'PROFESIONAL',
    'PROYECTO',
    'CODIGO',
    'DEPURACION',
    'TESTING',
    'ARQUITECTURA',
    'CONTENEDOR',
    'PIPELINE',
    'GITHUB',
    'NAVEGADOR',
    'APLICACION',
    'MODULAR',
    'ROUTING',
    'COMPONENTE',
    'DIRECTIVA',
    'SERVICIO',
    'VALIDACION',
    'FORMULARIO',
    'SEGURIDAD',
    'AUTENTICACION',
    'AUTORIZACION',
    'JUGADOR',
    'PUNTAJE',
    'CRONOMETRO',
    'ESTADISTICA',
    'RESULTADO',
    'PARTIDA',
    'TABLERO',
    'PALABRA',
    'LETRA',
    'INTENTO',
    'ACIERTO',
    'ERROR',
  ];

  readonly letters = 'ABCDEFGHIJKLMN\u00d1OPQRSTUVWXYZ'.split('');
  readonly maxErrors = 6;

  word = '';
  usedLetters = new Set<string>();
  selectedLetters: string[] = [];
  errors = 0;
  score = 0;
  correctGuesses = 0;
  wrongGuesses = 0;
  loadingWord = false;
  gameEnded = false;
  won = false;
  startTime = 0;
  elapsedSeconds = 0;
  mensaje = '';

  ngOnInit() {
    this.startNewGame();
  }

  get maskedWord() {
    return this.word
      .split('')
      .map((char) => (this.usedLetters.has(char) ? char : '_'))
      .join(' ');
  }

  get showHead() { return this.errors >= 1; }
  get showTorso() { return this.errors >= 2; }
  get showLeftArm() { return this.errors >= 3; }
  get showRightArm() { return this.errors >= 4; }
  get showLeftLeg() { return this.errors >= 5; }
  get showRightLeg() { return this.errors >= 6; }

  isLetterDisabled(letter: string) {
    return this.usedLetters.has(letter) || this.gameEnded || !this.word;
  }

  startNewGame() {
    // reinicia todo el estado de partida para empezar ronda limpia
    this.loadingWord = true;
    this.gameEnded = false;
    this.won = false;
    this.errors = 0;
    this.score = 0;
    this.correctGuesses = 0;
    this.wrongGuesses = 0;
    this.usedLetters = new Set<string>();
    this.selectedLetters = [];
    this.mensaje = '';
    this.word = this.getWordFromBank();
    this.startTime = Date.now();
    this.elapsedSeconds = 0;
    this.loadingWord = false;
  }

  async chooseLetter(letter: string) {
    // procesa intento y actualiza puntaje/estado segun acierto o error
    if (this.isLetterDisabled(letter)) {
      return;
    }

    this.usedLetters.add(letter);
    this.selectedLetters.push(letter);

    if (this.word.includes(letter)) {
      this.correctGuesses += 1;
      this.score += 5;
    } else {
      this.errors += 1;
      this.wrongGuesses += 1;
      this.score = Math.max(0, this.score - 2);
    }

    const solved = this.word.split('').every((char) => this.usedLetters.has(char));
    const lost = this.errors >= this.maxErrors;

    if (solved || lost) {
      // al terminar, calcula duracion y persiste resultado del jugador
      this.gameEnded = true;
      this.won = solved;
      this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.mensaje = solved ? 'Ganaste la ronda.' : `Perdiste. La palabra era ${this.word}.`;
      await this.guardarResultado(this.crearSnapshotResultado());
    }
  }

  private crearSnapshotResultado(): HangmanResult {
    // snapshot inmutable del cierre de partida para guardar en db
    return {
      user_id: '',
      word: this.word,
      selected_letters: [...this.selectedLetters],
      selected_letters_count: this.selectedLetters.length,
      correct_guesses: this.correctGuesses,
      wrong_guesses: this.wrongGuesses,
      score: this.score,
      status: this.won ? 'win' : 'loss',
      duration_seconds: this.elapsedSeconds,
      finished_at: new Date().toISOString(),
    };
  }

  private async guardarResultado(snapshot: HangmanResult) {
    // solo guarda si hay sesion autenticada
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }

    await this.supabase.saveHangmanResult({
      ...snapshot,
      user_id: user.id,
    });
  }

  private getWordFromBank() {
    // seleccion aleatoria simple del banco local
    const index = Math.floor(Math.random() * this.wordBank.length);
    return this.wordBank[index];
  }
}
