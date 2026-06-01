import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface NewDeckResponse {
  success: boolean;
  deck_id: string;
  remaining: number;
  shuffled: boolean;
}

interface DrawCardsResponse {
  success: boolean;
  deck_id: string;
  remaining: number;
  cards: Array<{
    code: string;
    image: string;
    value: string;
    suit: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class DeckApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://deckofcardsapi.com/api/deck';

  async createShuffledDeck() {
    // crea mazo remoto mezclado para mayor o menor
    return firstValueFrom(
      this.http.get<NewDeckResponse>(`${this.baseUrl}/new/shuffle/?deck_count=1`)
    );
  }

  async drawCards(deckId: string, count = 1) {
    // roba cartas del mazo remoto actual
    return firstValueFrom(
      this.http.get<DrawCardsResponse>(`${this.baseUrl}/${deckId}/draw/?count=${count}`)
    );
  }
}
