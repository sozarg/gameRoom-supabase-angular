import { Component } from '@angular/core';

@Component({
  selector: 'app-game-card',
  standalone: true,
  template: `
    <div class="arc-card transition-all duration-150 flex flex-col h-full">
      <div class="arc-card-head">
        <ng-content select="[title]"></ng-content>
      </div>

      <div class="arc-card-body min-h-[150px] flex flex-col flex-1">
        <ng-content></ng-content>
      </div>

      <div class="arc-card-actions">
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
    .arc-card {
      background: var(--surface);
      border: 2px solid var(--line);
      border-radius: var(--r);
      padding: 1rem;
      box-shadow: var(--shadow);
    }

    .arc-card-head {
      margin-bottom: 0.8rem;
      border-bottom: 2px solid var(--line);
      padding-bottom: 0.65rem;
    }

    .arc-card-body {
      color: var(--ink-soft);
    }

    .arc-card-actions {
      margin-top: 0.9rem;
      padding-top: 0.7rem;
      border-top: 2px solid var(--line);
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    `,
  ]
})
export class GameCard {}
