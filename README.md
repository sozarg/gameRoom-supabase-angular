# GameRoom

High-performance browser game platform built with Angular and Supabase.

Academic project developed for university coursework and delivered with top-grade quality standards, including production-style architecture, real-time features, authentication, and game result persistence.

---

## Project Overview

GameRoom is a multi-game web application that combines:

- User authentication and profile management
- Real-time global chat
- Multiple game modes in a single platform
- Persistent scoreboards and results history
- Responsive UI with a cohesive retro-inspired visual identity

The goal was to design and implement a complete, end-to-end product that feels like a real production application instead of a classroom prototype.

---

## Core Features

- Secure sign up and login flow with Supabase Auth
- Route protection through Angular guards
- Real-time chat powered by Supabase Realtime channels
- Live leaderboard updates for all games
- Game modules:
  - Hangman
  - Higher / Lower
  - Preguntados-style trivia
  - Escape Room challenge
- Result tracking with score, duration, and status
- Standalone Angular components and modular routing

---

## Architecture

- Frontend framework: Angular 21 (standalone APIs)
- Backend-as-a-service: Supabase
- Data access layer centralized in a dedicated service
- Feature-based routing for game modules
- Reusable directives/components for interaction and UI consistency

---

## Tech Stack

- Angular
- TypeScript
- RxJS
- Supabase (`@supabase/supabase-js`)
- Tailwind CSS
- Vercel (deployment)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/sozarg/gameRoom-supabase-angular.git
cd gameRoom-supabase-angular
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Supabase

Open:

`src/environments/environment.ts`

Set your project values:

```ts
export const environment = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
};
```

Important security notes:

- Use only the publishable (public/client) key in the frontend
- Never expose `service_role` keys in client code
- Keep RLS enabled and validated in all public tables

### 4. Run the project locally

```bash
ng serve
```

Open:

`http://localhost:4200/`

---

## Build

```bash
ng build
```

Production output is generated in:

`dist/`

---

## Deployment

This project is compatible with Vercel and can be deployed directly from the repository.

Recommended production workflow:

- Connect repository in Vercel
- Add environment/config values if needed
- Enable automatic deploys from `main`

---

## License

This repository is published for academic and portfolio purposes.
