import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { Supabase } from '../../../../services/supabase';
import { EscapeRoomResult } from '../../../../types/game.types';

type Rect = {
  // define posicion horizontal porcentual del elemento en escena
  left: number;
  // define posicion vertical porcentual del elemento en escena
  top: number;
  // define ancho porcentual del elemento en escena
  width: number;
  // define alto porcentual del elemento en escena
  height: number;
};

@Component({
  selector: 'app-escape-room',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './escape-room.html',
  styleUrls: ['./escape-room.css'],
})
export class EscapeRoom implements OnInit, OnDestroy {
  // inyectamos servicios base para guardar resultados y refrescar la vista cuando hace falta
  private readonly supabase = inject(Supabase);
  private readonly cdr = inject(ChangeDetectorRef);
  // configuramos el tiempo maximo fijo por partida
  private readonly maxTimeSeconds = 360;
  // este es el mensaje neutro que mostramos mientras el jugador explora
  private readonly defaultMessage = 'Explora la habitación y escapa antes de que termine el tiempo.';
  // guarda la suscripcion viva del cronometro para poder detenerla
  private timerSub: Subscription | null = null;
  // controla timeout del mensaje temporal de error
  private messageResetTimeout: ReturnType<typeof setTimeout> | null = null;
  // controla timeout de fin de animacion de puerta
  private doorShakeTimeout: ReturnType<typeof setTimeout> | null = null;
  // controla timeout de fin de animacion de caja fuerte
  private safeShakeTimeout: ReturnType<typeof setTimeout> | null = null;

  // esta lista nos permite precargar todos los sprites del rompecabezas al entrar
  private readonly preloadAssetList = [
    'assets/escritorio-cerrado-dentro.png',
    'assets/escritorio-abierto-dentro.png',
    'assets/cuadro-normal-dentro.png',
    'assets/caja-fuerte-cerrada-dentro.png',
    'assets/caja-fuerte-abierta-dentro.png',
    'assets/puerta-cerrada-dentro.png',
    'assets/puerta-abierta-dentro.png',
    'assets/nota-dentro.png',
    'assets/llave-dentro.png',
    'assets/gatito-feliz-dentro.png',
    'assets/gatito-enojado-dentro.png',
    'assets/alfombra-plana-dentro.png',
    'assets/alfombra-enrollada-dentro.png',
    'assets/cuadro2-dentro.png',
    'assets/cuadro3-dentro.png',
    'assets/cuadro4-dentro.png',
  ];

  // este layout centraliza coordenadas y tamaños de todos los objetos del escenario
  private readonly layout = {
    desk: { left: 6.5, top: 48, width: 30, height: 28.2 },
    note: { left: 19.4, top: 45, width: 5.5, height: 11 },
    key: { left: 44, top: 30, width: 8, height: 4 },
    frameClosed: { left: 42, top: 26.2, width: 17.8, height: 15.5 },
    frameMoved: { left: 42, top: 41.0, width: 17.8, height: 15.5 },
    safeClosed: { left: 42, top: 25.8, width: 15, height: 15 },
    safeOpened: { left: 42, top: 25.8, width: 18, height: 15 },
    door: { left: 73, top: 26.8, width: 20, height: 43 },
    cat: { left: 48, top: 53, width: 17, height: 24 },
    rug: { left: 40, top: 76, width: 40, height: 25 },
    decoFrame2: { left: 25, top: 24, width: 16, height: 18 },
    decoFrame3: { left: 59, top: 24, width: 13, height: 16 },
    decoFrame4: { left: 13.5, top: 24, width: 14, height: 19 },
  } as const;

  // estas banderas controlan el estado global de partida, mensajes y animaciones
  gameOver = false;
  // guarda si la partida termino en victoria o derrota
  status: 'win' | 'loss' | null = null;
  // marca si el resultado aun se esta guardandos en bassesdd
  savingResult = false;
  // indica si el mensaje actual debe pintarse en estilo de error
  messageIsError = false;
  // activa animacion de sacudida en puerta
  doorShake = false;
  // activa animacion de sacudida en caja fuerte
  safeShake = false;

  // contador principal de tiempo restante en segundos
  timeLeft = this.maxTimeSeconds;
  // cuenta intentos incorrectos de contraseña en caja fuerte
  wrongAttempts = 0;
  // representa el puntaje actual basado en tiempo restante
  score = this.maxTimeSeconds;
  // texto de estado mostrado al jugador durante la partida
  message = this.defaultMessage;

  // marca si el escritorio ya fue abierto
  deskOpened = false;
  // marca si el cuadro ya fue movido para revelar la caja
  frameMoved = false;
  // marca si la caja fuerte ya fue abierta
  safeOpened = false;
  // marca si la llave ya fue tomada
  keyCollected = false;
  // marca si la puerta se desbloqueo al final
  doorUnlocked = false;

  // controla visibilidad del modal de nota
  showNoteModal = false;
  // controla visibilidad del modal de caja fuerte
  showSafeModal = false;
  // guarda entrada actual del keypad de caja fuerte
  safeCodeInput = '';
  // define la contraseña correcta de la caja fuerte
  readonly safeCode = '2974';
  // alterna sprite del gato entre feliz y enojado
  catAngry = false;
  // alterna sprite de la alfombra entre plana y enrollada
  rugRolled = false;
  // activa shake del cuadro decorativo 2
  decoFrame2Shake = false;
  // activa shake del cuadro decorativo 3
  decoFrame3Shake = false;
  // activa shake del cuadro decorativo 4
  decoFrame4Shake = false;

  ngOnInit() {
    // precarga sprites para evitar parpadeos al interactuar
    this.preloadAssets();
    this.startGame();
  }

  ngOnDestroy() {
    // corta timer y timeouts para evitar fugas al salir de la vista
    this.stopTimer();
    this.clearTransientTimers();
  }

  get durationSeconds() {
    // calcula cuanto tiempo real uso el jugador desde el inicio
    return this.maxTimeSeconds - this.timeLeft;
  }

  get remainingSeconds() {
    // expone segundos restantes para mostrar en resumen final
    return this.timeLeft;
  }

  get timeLabel() {
    // formatea el cronometro como minutos y segundos
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  get deskSpriteStyle() {
    // devuelve estilo absoluto del escritorio basado en layout
    return this.rectStyle(this.layout.desk);
  }

  get noteSpriteStyle() {
    // devuelve estilo absoluto de la nota basada en layout
    return this.rectStyle(this.layout.note);
  }

  get frameRect() {
    // selecciona posicion del cuadro segun si ya se movio o no
    return this.frameMoved ? this.layout.frameMoved : this.layout.frameClosed;
  }

  get frameSpriteStyle() {
    // devuelve estilo visual del cuadro interactivo
    return this.rectStyle(this.frameRect);
  }

  get frameHotspotStyle() {
    // devuelve estilo del hotspot de click del cuadro
    return this.rectStyle(this.frameRect);
  }

  get safeRect() {
    // selecciona tamaño/posicion de caja fuerte segun estado abierta/cerrada
    return this.safeOpened ? this.layout.safeOpened : this.layout.safeClosed;
  }

  get safeSpriteStyle() {
    // devuelve estilo visual de la caja fuerte
    return this.rectStyle(this.safeRect);
  }

  get safeHotspotStyle() {
    // devuelve estilo del hotspot de click de la caja fuerte
    return this.rectStyle(this.safeRect);
  }

  get doorSpriteStyle() {
    // devuelve estilo visual de la puerta usando solo posicion y ancho
    return this.rectStyle({
      left: this.layout.door.left,
      top: this.layout.door.top,
      width: this.layout.door.width,
      height: 0,
    });
  }

  get deskHotspotStyle() {
    // devuelve estilo del area clickeable del escritorio
    return this.rectStyle(this.layout.desk);
  }

  get noteHotspotStyle() {
    // amplia levemente el area clickeable de la nota para mejorar ux
    return this.rectStyle({
      left: this.layout.note.left - 0.2,
      top: this.layout.note.top - 0.2,
      width: this.layout.note.width + 0.4,
      height: this.layout.note.height + 0.4,
    });
  }

  get keySpriteStyle() {
    // devuelve estilo visual de la llave en escena
    return this.rectStyle(this.layout.key);
  }

  get keyHotspotStyle() {
    // amplia levemente el area clickeable de la llave para mejorar ux
    return this.rectStyle({
      left: this.layout.key.left - 0.2,
      top: this.layout.key.top - 0.2,
      width: this.layout.key.width + 0.4,
      height: this.layout.key.height + 0.4,
    });
  }

  get doorHotspotStyle() {
    // devuelve estilo del area clickeable de la puerta
    return this.rectStyle(this.layout.door);
  }

  get catSpriteStyle() {
    // devuelve estilo visual del gatito decorativo
    return this.rectStyle(this.layout.cat);
  }

  get catHotspotStyle() {
    // devuelve estilo del area clickeable del gatito
    return this.rectStyle(this.layout.cat);
  }

  get rugSpriteStyle() {
    // devuelve estilo visual de la alfombra decorativa
    return this.rectStyle(this.layout.rug);
  }

  get rugHotspotStyle() {
    // devuelve estilo del area clickeable de la alfombra
    return this.rectStyle(this.layout.rug);
  }

  get decoFrame2Style() {
    // devuelve estilo visual del cuadro decorativo 2
    return this.rectStyle(this.layout.decoFrame2);
  }

  get decoFrame3Style() {
    // devuelve estilo visual del cuadro decorativo 3
    return this.rectStyle(this.layout.decoFrame3);
  }

  get decoFrame4Style() {
    // devuelve estilo visual del cuadro decorativo 4
    return this.rectStyle(this.layout.decoFrame4);
  }

  get safeLocked() {
    // la caja solo se puede abrir despues de mover el cuadro
    return !this.frameMoved || this.gameOver;
  }

  get deskDone() {
    // informa si el objetivo de escritorio ya esta completado
    return this.deskOpened;
  }

  get frameDone() {
    // informa si el objetivo de cuadro ya esta completado
    return this.frameMoved;
  }

  get safeDone() {
    // informa si el objetivo de caja fuerte ya esta completado
    return this.safeOpened;
  }

  startGame() {
    // reinicia todo el estado del rompecabezas y del cronometro
    this.stopTimer();
    this.clearTransientTimers();

    this.gameOver = false;
    this.status = null;
    this.savingResult = false;

    this.timeLeft = this.maxTimeSeconds;
    this.score = this.maxTimeSeconds;
    this.wrongAttempts = 0;
    this.message = this.defaultMessage;
    this.messageIsError = false;
    this.doorShake = false;
    this.safeShake = false;

    this.deskOpened = false;
    this.frameMoved = false;
    this.safeOpened = false;
    this.keyCollected = false;
    this.doorUnlocked = false;

    this.showNoteModal = false;
    this.showSafeModal = false;
    this.safeCodeInput = '';
    this.catAngry = false;
    this.rugRolled = false;
    this.decoFrame2Shake = false;
    this.decoFrame3Shake = false;
    this.decoFrame4Shake = false;

    // cronometro principal: descuenta 1 segundo por tick
    this.timerSub = interval(1000).subscribe(() => {
      if (this.gameOver) {
        this.stopTimer();
        return;
      }

      this.timeLeft = Math.max(0, this.timeLeft - 1);
      this.score = this.timeLeft;
      // repinta cronometro y score en cada tick
      this.cdr.detectChanges();

      if (this.timeLeft === 0) {
        this.endGame('loss', 'Perdiste: se terminó el tiempo.');
      }
    });
  }

  openDesk() {
    // habilita el estado de cajon abierto solo una vez por partida
    if (this.gameOver || this.deskOpened) return;
    this.deskOpened = true;
  }

  pickNote() {
    // abre el modal de la nota cuando el cajon ya esta disponible
    if (this.gameOver || !this.deskOpened) return;
    this.showNoteModal = true;
  }

  closeNoteModal() {
    // cierra el modal informativo de la nota
    this.showNoteModal = false;
  }

  quickMoveFrame() {
    // mueve el cuadro para revelar la caja fuerte oculta
    if (this.gameOver || this.frameMoved) return;
    this.frameMoved = true;
  }

  openSafe() {
    // abre el modal del teclado solo si la caja ya esta desbloqueada por progreso
    if (this.gameOver || !this.frameMoved || this.safeOpened) return;
    this.showSafeModal = true;
  }

  closeSafeModal() {
    // cierra manualmente el modal de caja fuerte
    this.showSafeModal = false;
  }

  keypad(value: string) {
    // procesa cada tecla del keypad respetando limpiar, borrar y limite de 4 digitos
    if (this.gameOver || this.safeOpened) return;
    if (value === 'clear') {
      this.safeCodeInput = '';
      return;
    }
    if (value === 'back') {
      this.safeCodeInput = this.safeCodeInput.slice(0, -1);
      return;
    }
    if (this.safeCodeInput.length >= 4) return;
    this.safeCodeInput += value;
  }

  submitSafeCode() {
    // valida la contraseña ingresada y resuelve apertura o error temporal
    if (this.gameOver || this.safeOpened || this.safeCodeInput.length !== 4) return;

    if (this.safeCodeInput === this.safeCode) {
      // desbloquea caja fuerte cuando coincide el codigo correcto
      this.safeOpened = true;
      this.showSafeModal = false;
      return;
    }

    this.wrongAttempts += 1;
    this.safeCodeInput = '';
    this.showSafeModal = false;
    this.safeShake = true;
    if (this.safeShakeTimeout) clearTimeout(this.safeShakeTimeout);
    this.safeShakeTimeout = setTimeout(() => {
      this.safeShake = false;
      // corta animacion de sacudida de caja en la vista
      this.cdr.detectChanges();
    }, 220);
    this.showTemporaryError('¡Contraseña incorrecta!', 3000);
  }

  tryDoor() {
    // intenta salida final y solo permite ganar si la llave ya fue recogida
    if (this.gameOver) return;
    if (!this.keyCollected) {
      // puerta bloqueada hasta recoger llave de la caja fuerte
      this.doorShake = true;
      if (this.doorShakeTimeout) clearTimeout(this.doorShakeTimeout);
      this.doorShakeTimeout = setTimeout(() => {
        this.doorShake = false;
        // corta animacion de sacudida de puerta en la vista
        this.cdr.detectChanges();
      }, 220);
      this.showTemporaryError('La puerta está cerrada con llave. ¿Dónde estará?', 3000);
      return;
    }

    this.doorUnlocked = true;
    this.endGame('win', 'Escapaste de la habitación. Nuevo intento para mejorar tu récord.');
  }

  pickKey() {
    // marca la llave como recogida para habilitar apertura final de puerta
    if (this.gameOver || !this.safeOpened || this.keyCollected) return;
    this.keyCollected = true;
  }

  toggleCatMood() {
    // alterna sprite del gatito como interaccion decorativa
    if (this.gameOver) return;
    this.catAngry = !this.catAngry;
  }

  toggleRug() {
    // alterna sprite de alfombra para sumar feedback visual
    if (this.gameOver) return;
    this.rugRolled = !this.rugRolled;
  }

  pokeDecoFrame(frame: 2 | 3 | 4) {
    // aplica una vibracion breve a cuadros decorativos sin afectar progreso
    if (this.gameOver) return;

    if (frame === 2) this.decoFrame2Shake = true;
    if (frame === 3) this.decoFrame3Shake = true;
    if (frame === 4) this.decoFrame4Shake = true;

    setTimeout(() => {
      if (frame === 2) this.decoFrame2Shake = false;
      if (frame === 3) this.decoFrame3Shake = false;
      if (frame === 4) this.decoFrame4Shake = false;
      // repinta fin de animacion de cuadros decorativos
      this.cdr.detectChanges();
    }, 220);
  }

  private endGame(status: 'win' | 'loss', message: string) {
    // cierra partida, detiene timers y dispara guardado de resultado
    if (this.gameOver) return;

    this.gameOver = true;
    this.status = status;
    this.message = message;
    this.messageIsError = status === 'loss';
    this.stopTimer();
    this.clearTransientTimers();

    if (status === 'loss') {
      this.score = 0;
    } else {
      this.score = this.timeLeft;
    }

    void this.saveResult();
  }

  private async saveResult() {
    // persiste tiempo y estado final en ranking de escape room
    const user = await this.supabase.getCurrentUser();
    if (!user || !this.status) return;

    const payload: EscapeRoomResult = {
      user_id: user.id,
      status: this.status,
      duration_seconds: this.durationSeconds,
      score: this.score,
      finished_at: new Date().toISOString(),
    };

    this.savingResult = true;
    try {
      await this.supabase.saveEscapeRoomResult(payload);
    } finally {
      this.savingResult = false;
    }
  }

  private stopTimer() {
    // helper para cortar cronometro de forma segura
    if (!this.timerSub) return;
    this.timerSub.unsubscribe();
    this.timerSub = null;
  }

  private showTemporaryError(message: string, durationMs: number) {
    // muestra error transitorio y luego restaura mensaje base
    this.message = message;
    this.messageIsError = true;

    if (this.messageResetTimeout) clearTimeout(this.messageResetTimeout);
    this.messageResetTimeout = setTimeout(() => {
      if (this.gameOver) return;
      this.message = this.defaultMessage;
      this.messageIsError = false;
      // restaura mensaje base luego del error temporal
      this.cdr.detectChanges();
    }, durationMs);
  }

  private clearTransientTimers() {
    // limpia timeouts de animaciones y mensajes temporales
    if (this.messageResetTimeout) {
      clearTimeout(this.messageResetTimeout);
      this.messageResetTimeout = null;
    }
    if (this.doorShakeTimeout) {
      clearTimeout(this.doorShakeTimeout);
      this.doorShakeTimeout = null;
    }
    if (this.safeShakeTimeout) {
      clearTimeout(this.safeShakeTimeout);
      this.safeShakeTimeout = null;
    }
  }

  private rectStyle(rect: Rect) {
    // transforma coordenadas del layout en estilos porcentuales reutilizables
    return {
      left: this.pct(rect.left),
      top: this.pct(rect.top),
      width: this.pct(rect.width),
      ...(rect.height > 0 ? { height: this.pct(rect.height) } : {}),
    };
  }

  private pct(value: number) {
    // helper para unificar conversion de numero a porcentaje css
    return `${value}%`;
  }

  private preloadAssets() {
    // recorre y precarga todos los sprites en cache del navegador
    for (const src of this.preloadAssetList) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    }
  }
}

