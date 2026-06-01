import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { ChatMessage, EscapeRoomResult, HangmanResult, HigherLowerResult, PreguntadosResult } from '../types/game.types';

@Injectable({
  providedIn: 'root'
})
export class Supabase {
  public client: SupabaseClient;
  // estado global de autenticacion
  // guarda el usuario actual y avisa cambios a todos los componentes
  user$ = new BehaviorSubject<any>(null);

  constructor(private router: Router) {
    // cliente principal: auth, base de datos y realtime
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
      realtime: {
        worker: true,
        heartbeatCallback: (status) => {
          if (status === 'disconnected') {
            this.client.realtime.connect();
          }
        },
      },
    });
    this.initAuthState();
  }

  signUp(email: string, password: string, firstName: string) {
    // registra usuario en supabase auth y guarda firstName en metadata
    return this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName: firstName
        }
      }
    });
  }

  iniciarSesion(email: string, password: string) {
    // login con email y password
    return this.client.auth.signInWithPassword({
      email,
      password,
    });
  }

  logout() {
    // cierra sesion, redirige a login y publica null en user$
    this.client.auth.signOut().then(() => {
      this.router.navigate(['/login']);
      // avisamos que ya no hay usuario logueado
      this.user$.next(null);
    });
  }

  saveUserProfile(id: string, firstName: string, lastName: string, age: number, email: string) {
    // guarda perfil extendido en la tabla profiles
    return this.client.from('profiles').insert([
      { id, first_name: firstName, last_name: lastName, age, email }
    ]);
  }

  getUserProfile(id: string) {
    // trae un perfil por id para mostrar datos en la ui
    return this.client
      .from('profiles')
      .select('first_name, last_name, email, age')
      .eq('id', id)
      .maybeSingle();
  }

  getProfilesByIds(ids: string[]) {
    if (!ids.length) {
      return Promise.resolve({ data: [], error: null } as any);
    }

    return this.client
      .from('profiles')
      .select('id, first_name')
      .in('id', ids);
  }

  saveHangmanResult(result: HangmanResult) {
    // guarda resultado final del juego ahorcado
    return this.client.from('hangman_results').insert([result]);
  }

  async getHangmanTopResults(limit = 10) {
    return this.client
      .from('hangman_results')
      .select('id, user_id, word, selected_letters, selected_letters_count, correct_guesses, wrong_guesses, score, status, duration_seconds, finished_at')
      .order('score', { ascending: false })
      .order('duration_seconds', { ascending: true })
      .limit(limit);
  }

  saveHigherLowerResult(result: HigherLowerResult) {
    // guarda resultado final del juego mayor o menor
    return this.client.from('higher_lower_results').insert([result]);
  }

  async getHigherLowerTopResults(limit = 10) {
    return this.client
      .from('higher_lower_results')
      .select('id, user_id, score, correct_guesses, wrong_guesses, ties_count, best_streak, status, duration_seconds, finished_at')
      .order('score', { ascending: false })
      .order('duration_seconds', { ascending: true })
      .limit(limit);
  }

  savePreguntadosResult(result: PreguntadosResult) {
    // guarda resultado final del juego preguntados
    return this.client.from('preguntados_results').insert([result]);
  }

  async getPreguntadosTopResults(limit = 10) {
    return this.client
      .from('preguntados_results')
      .select('id, user_id, score, correct_answers, wrong_answers, lives_lost, total_questions, status, duration_seconds, finished_at')
      .order('score', { ascending: false })
      .order('duration_seconds', { ascending: true })
      .limit(limit);
  }

  saveEscapeRoomResult(result: EscapeRoomResult) {
    // guarda resultado final del escape room
    return this.client.from('escape_room_results').insert([result]);
  }

  async getEscapeRoomTopResults(limit = 10) {
    return this.client
      .from('escape_room_results')
      .select('id, user_id, status, duration_seconds, score, finished_at')
      .eq('status', 'win')
      .order('duration_seconds', { ascending: true })
      .order('finished_at', { ascending: true })
      .limit(limit);
  }

  sendChatMessage(message: ChatMessage) {
    // inserta mensaje en chat global y devuelve el mensaje creado
    return this.client
      .from('chat_messages')
      .insert([message])
      .select('id, user_id, display_name, message_text, created_at')
      .single();
  }

  async getChatMessages(limit = 50) {
    return this.client
      .from('chat_messages')
      .select('id, user_id, display_name, message_text, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
  }

  async getChatMessagesAfter(createdAtIso: string, limit = 80) {
    return this.client
      .from('chat_messages')
      .select('id, user_id, display_name, message_text, created_at')
      .gt('created_at', createdAtIso)
      .order('created_at', { ascending: true })
      .limit(limit);
  }

  subscribeToChatMessages(
    onInsert: (payload: any) => void,
    onStatus?: (status: string) => void
  ): RealtimeChannel {
    // escucha mensajes nuevos del chat en tiempo real
    return this.client
      .channel('chat-messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        onInsert
      )
      .subscribe((status) => {
        onStatus?.(status);
      });
  }

  subscribeToResultsChanges(
    onChange: (payload: any) => void,
    onStatus?: (status: string) => void,
    channelName = `results-channel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ): RealtimeChannel {
    // escucha nuevos resultados de todos los juegos en tiempo real
    return this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hangman_results' },
        onChange
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'higher_lower_results' },
        onChange
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'preguntados_results' },
        onChange
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'escape_room_results' },
        onChange
      )
      .subscribe((status) => {
        onStatus?.(status);
      });
  }

  removeChannel(channel: RealtimeChannel) {
    // corta una suscripcion realtime cuando ya no se necesita
    this.client.removeChannel(channel);
  }

  async getCurrentUser() {
    // devuelve el usuario actual de la sesion
    const { data: { user } } = await this.client.auth.getUser();
    return user;
  }

  private async initAuthState() {
    const { data: { session } } = await this.client.auth.getSession();
    // al iniciar la app cargamos el usuario actual (si existe)
    this.user$.next(session?.user ?? null);

    this.client.auth.onAuthStateChange((_event, session) => {
      // si cambia la sesion, actualizamos el usuario para toda la app
      this.user$.next(session?.user ?? null);
    });
  }
}
