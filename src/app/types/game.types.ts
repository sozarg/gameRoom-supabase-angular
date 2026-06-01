export interface HangmanResult {
  user_id: string;
  word: string;
  selected_letters: string[];
  selected_letters_count: number;
  correct_guesses: number;
  wrong_guesses: number;
  score: number;
  status: 'win' | 'loss';
  duration_seconds: number;
  finished_at: string;
}

export interface HigherLowerResult {
  user_id: string;
  score: number;
  correct_guesses: number;
  wrong_guesses: number;
  ties_count: number;
  best_streak: number;
  status: 'win' | 'loss';
  duration_seconds: number;
  history: HigherLowerPlay[];
  finished_at: string;
}

export interface HigherLowerPlay {
  current_card_code: string;
  drawn_card_code: string;
  guess: 'mayor' | 'menor';
  outcome: 'correct' | 'wrong' | 'tie';
  score_delta: number;
}

export interface ChatMessage {
  user_id: string;
  display_name: string;
  message_text: string;
}

export interface PreguntadosQuestionPlay {
  round: number;
  country_code: string;
  country_name: string;
  selected_option: string;
  options: string[];
  is_correct: boolean;
  score_delta: number;
}

export interface PreguntadosResult {
  user_id: string;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  lives_lost: number;
  total_questions: number;
  status: 'win' | 'loss';
  duration_seconds: number;
  questions_played: PreguntadosQuestionPlay[];
  finished_at: string;
}

export interface EscapeRoomResult {
  user_id: string;
  status: 'win' | 'loss';
  duration_seconds: number;
  score: number;
  finished_at: string;
}
