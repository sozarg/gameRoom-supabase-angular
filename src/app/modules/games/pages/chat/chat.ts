import { ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from '../../../../services/supabase';

interface UiMessage {
  id: number | string;
  user_id: string;
  display_name: string;
  message_text: string;
  created_at: string | null;
  pending?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css'],
})
export class Chat implements OnInit, OnDestroy {
  private readonly supabase = inject(Supabase);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  canal: RealtimeChannel | null = null;
  mensajes: UiMessage[] = [];
  nuevoMensaje = '';
  userId = '';
  userName = 'Usuario';
  cargando = true;
  estadoRealtime = 'Conectando...';
  errorCarga = '';
  @ViewChild('chatList') chatListRef?: ElementRef<HTMLDivElement>;
  private readonly pendingByTempId = new Map<string, number>();
  // guarda timestamp del ultimo mensaje visible para sincronizar rezagados
  private lastMessageCreatedAt: string | null = null;
  private readonly onVisibilityChange = () => {
    if (!document.hidden) {
      void this.syncMensajesPendientes();
    }
  };

  async ngOnInit() {
    // escucha volver a foco para recuperar mensajes que hayan quedado pendientes
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    try {
      const user = await this.supabase.getCurrentUser();
      this.zone.run(() => {
        if (!user) {
          this.errorCarga = this.errorCarga || 'No se pudo validar la sesión del chat.';
          // repinta para mostrar error de sesion inmediatamente
          this.cdr.detectChanges();
          return;
        }

        this.userId = user.id;
        this.userName = user.user_metadata?.['firstName'] || 'Usuario';
        // actualiza cabecera del chat con usuario autenticado
        this.cdr.detectChanges();
      });
    } catch {
      this.zone.run(() => {
        this.errorCarga = this.errorCarga || 'No se pudo validar la sesión del chat.';
        // refleja error de sesion en la ui
        this.cdr.detectChanges();
      });
    }

    try {
      try {
        this.canal = this.supabase.subscribeToChatMessages(
          (payload) => {
            const inserted = payload.new as UiMessage;
            this.zone.run(() => {
              // solo autoscrollea si el usuario ya estaba cerca del final
              const shouldAutoScroll = this.isNearBottom();
              this.logRealtimeLag(inserted);
              this.agregarMensajeSinDuplicados(inserted, shouldAutoScroll);
              this.cdr.detectChanges();
            });
          },
          (status) => {
            this.zone.run(() => {
              this.estadoRealtime = this.mapRealtimeStatus(status);
              if (status === 'SUBSCRIBED') {
                // al reconectar, intenta traer mensajes que pudieron perderse
                void this.syncMensajesPendientes();
              }
            });
          }
        );
      } catch {
        this.zone.run(() => {
          this.estadoRealtime = 'Tiempo real no disponible';
        });
      }

      const mensajesResult = await this.supabase.getChatMessages(80);

      this.zone.run(() => {
        if (mensajesResult.error) {
          this.errorCarga = 'No se pudieron cargar los mensajes.';
          // muestra error al cargar historial inicial
          this.cdr.detectChanges();
          return;
        }

        this.mensajes = [...((mensajesResult.data ?? []) as UiMessage[])].reverse();
        this.lastMessageCreatedAt = this.mensajes.length
          ? this.mensajes[this.mensajes.length - 1].created_at
          : null;
        // repinta lista luego de hidratar mensajes iniciales
        this.cdr.detectChanges();
        this.scrollChatToBottom();
      });
    } catch {
      this.zone.run(() => {
        this.errorCarga = 'No se pudieron cargar los mensajes.';
        // refleja fallo general de carga del chat
        this.cdr.detectChanges();
      });
    } finally {
      this.zone.run(() => {
        this.cargando = false;
        // quita estado de cargando al finalizar init
        this.cdr.detectChanges();
      });
    }
  }

  ngOnDestroy() {
    // limpia listeners y canal realtime para evitar fugas
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.canal) {
      this.supabase.removeChannel(this.canal);
    }
  }

  async enviar() {
    // optimista: primero muestra mensaje temporal y luego confirma con backend
    const texto = this.nuevoMensaje.trim();
    if (!texto || !this.userId) {
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempMessage: UiMessage = {
      id: tempId,
      user_id: this.userId,
      display_name: this.userName,
      message_text: texto,
      created_at: null,
      pending: true,
    };

    this.agregarMensajeSinDuplicados(tempMessage, true);
    this.nuevoMensaje = '';
    this.pendingByTempId.set(tempId, Date.now());
    try {
      const { data, error } = await this.supabase.sendChatMessage({
        user_id: this.userId,
        display_name: this.userName,
        message_text: texto,
      });

      this.zone.run(() => {
        if (error) {
          this.quitarTemporalYRestaurarInput(tempId, texto);
          this.errorCarga = 'No se pudo enviar el mensaje. Reintenta.';
          // repinta rollback cuando falla envio
          this.cdr.detectChanges();
          return;
        }

        if (data) {
          this.reemplazarTemporalPorConfirmado(tempId, data as UiMessage);
          this.logConfirmacionInsert(tempId, data as UiMessage);
          this.errorCarga = '';
          // refleja confirmacion de envio
          this.cdr.detectChanges();
          return;
        }

        this.quitarTemporalYRestaurarInput(tempId, texto);
        this.errorCarga = 'No se pudo confirmar el mensaje enviado.';
        // repinta error cuando no hay confirmacion util
        this.cdr.detectChanges();
      });
    } catch {
      this.zone.run(() => {
        this.quitarTemporalYRestaurarInput(tempId, texto);
        this.errorCarga = 'No se pudo enviar el mensaje. Reintenta.';
        // refleja error de red en envio
        this.cdr.detectChanges();
      });
    }
  }

  isMine(msg: UiMessage) {
    return msg.user_id === this.userId;
  }

  private agregarMensajeSinDuplicados(msg: UiMessage, autoScroll: boolean) {
    // evita duplicados cuando llega el mismo mensaje por insert + realtime
    const existe = this.mensajes.some((m) => m.id === msg.id);

    if (!existe) {
      this.mensajes = [...this.mensajes, msg];
      if (msg.created_at) {
        this.lastMessageCreatedAt = msg.created_at;
      }
      if (autoScroll) {
        this.scrollChatToBottom();
      }
    }
  }

  private reemplazarTemporalPorConfirmado(tempId: string, confirmed: UiMessage) {
    // reemplaza el mensaje pendiente por el confirmado sin perder orden visual
    const confirmedMessage: UiMessage = {
      ...confirmed,
      pending: false,
    };
    const tempIndex = this.mensajes.findIndex((m) => m.id === tempId);
    const confirmedIndex = this.mensajes.findIndex((m) => m.id === confirmedMessage.id);

    if (confirmedIndex !== -1 && tempIndex !== -1) {
      this.mensajes = this.mensajes.filter((m) => m.id !== tempId);
      if (confirmedMessage.created_at) {
        this.lastMessageCreatedAt = confirmedMessage.created_at;
      }
      this.scrollChatToBottom();
      this.cdr.detectChanges();
      return;
    }

    if (tempIndex === -1) {
      this.agregarMensajeSinDuplicados(confirmedMessage, true);
      return;
    }

    const next = [...this.mensajes];
    next[tempIndex] = confirmedMessage;
    this.mensajes = next;
    if (confirmedMessage.created_at) {
      this.lastMessageCreatedAt = confirmedMessage.created_at;
    }
    this.scrollChatToBottom();
    this.cdr.detectChanges();
  }

  private quitarTemporalYRestaurarInput(tempId: string, textoOriginal: string) {
    // revierte envio optimista si falla persistencia
    this.mensajes = this.mensajes.filter((m) => m.id !== tempId);
    this.nuevoMensaje = textoOriginal;
    this.pendingByTempId.delete(tempId);
    this.cdr.detectChanges();
  }

  private mapRealtimeStatus(status: string) {
    // traduce estados tecnicos del canal a mensajes de ui
    if (status === 'SUBSCRIBED') return '';
    if (status === 'CHANNEL_ERROR') return 'Error de tiempo real';
    if (status === 'TIMED_OUT') return 'Tiempo real con demora';
    if (status === 'CLOSED') return 'Tiempo real desconectado';
    return '';
  }

  private logConfirmacionInsert(tempId: string, confirmed: UiMessage) {
    // metrica simple para medir tiempo entre envio y confirmacion
    const startedAt = this.pendingByTempId.get(tempId);
    this.pendingByTempId.delete(tempId);
    if (!startedAt) {
      return;
    }

    const insertMs = Date.now() - startedAt;
    console.log('[chat] insert confirmado', {
      tempId,
      insertMs,
      created_at: confirmed.created_at,
    });
  }

  private logRealtimeLag(inserted: UiMessage) {
    // diagnostico de demora realtime segun timestamp del registro
    if (!inserted.created_at) {
      return;
    }

    const createdAtMs = new Date(inserted.created_at).getTime();
    if (Number.isNaN(createdAtMs)) {
      return;
    }

    const lagMs = Date.now() - createdAtMs;
    if (lagMs > 3000) {
      console.warn('[chat] realtime lag alto', {
        id: inserted.id,
        lagMs,
        created_at: inserted.created_at,
      });
    } else {
      console.log('[chat] realtime lag', {
        id: inserted.id,
        lagMs,
      });
    }
  }

  private async syncMensajesPendientes() {
    // trae mensajes posteriores al ultimo visible para cerrar huecos de sync
    if (!this.lastMessageCreatedAt) {
      return;
    }

    const { data, error } = await this.supabase.getChatMessagesAfter(this.lastMessageCreatedAt, 80);
    if (error || !data?.length) {
      return;
    }

    this.zone.run(() => {
      const shouldAutoScroll = this.isNearBottom();
      for (const msg of data as UiMessage[]) {
        this.agregarMensajeSinDuplicados(msg, shouldAutoScroll);
      }
      // repinta mensajes recuperados tras reconexion
      this.cdr.detectChanges();
    });
  }

  private isNearBottom(thresholdPx = 40) {
    // define si conviene autoscrollear sin interrumpir lectura del usuario
    const list = this.chatListRef?.nativeElement;
    if (!list) {
      return true;
    }

    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    return distanceToBottom <= thresholdPx;
  }

  private scrollChatToBottom() {
    // espera un frame para asegurar que el dom ya renderizo el mensaje nuevo
    requestAnimationFrame(() => {
      const list = this.chatListRef?.nativeElement;
      if (!list) {
        return;
      }
      list.scrollTop = list.scrollHeight;
    });
  }

}
