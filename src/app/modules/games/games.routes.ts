import { Routes } from '@angular/router';
import { Hangman } from './pages/hangman/hangman';
import { HigherLower } from './pages/higher-lower/higher-lower';
import { Chat } from './pages/chat/chat';
import { Preguntados } from './pages/preguntados/preguntados';
import { EscapeRoom } from './pages/escape-room/escape-room';

export const JUEGOS_ROUTES: Routes = [
  { path: 'ahorcado', component: Hangman },
  { path: 'mayor-o-menor', component: HigherLower },
  { path: 'chat', component: Chat },
  { path: 'preguntados', component: Preguntados },
  { path: 'escapa-de-la-habitacion', component: EscapeRoom },
  { path: 'juego-propio', component: EscapeRoom },
  { path: '', redirectTo: 'ahorcado', pathMatch: 'full' }
];
