export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          answered_at: string
          choice_index: number
          correct: boolean
          id: string
          player_id: string
          points_awarded: number
          question_id: string
          room_id: string
        }
        Insert: {
          answered_at?: string
          choice_index: number
          correct: boolean
          id?: string
          player_id: string
          points_awarded?: number
          question_id: string
          room_id: string
        }
        Update: {
          answered_at?: string
          choice_index?: number
          correct?: boolean
          id?: string
          player_id?: string
          points_awarded?: number
          question_id?: string
          room_id?: string
        }
        Relationships: []
      }
      category_votes: {
        Row: { room_id: string; player_id: string; choice: number; voted_at: string }
        Insert: { room_id: string; player_id: string; choice: number; voted_at?: string }
        Update: { room_id?: string; player_id?: string; choice?: number; voted_at?: string }
        Relationships: []
      }
      bingo_players: {
        Row: {
          id: string
          room_id: string
          nickname: string
          client_token: string
          joined_at: string
          card: Json
          marked: Json
          score: number
          bingo_at: string | null
        }
        Insert: {
          id?: string
          room_id: string
          nickname: string
          client_token?: string
          joined_at?: string
          card?: Json
          marked?: Json
          score?: number
          bingo_at?: string | null
        }
        Update: {
          id?: string
          room_id?: string
          nickname?: string
          client_token?: string
          joined_at?: string
          card?: Json
          marked?: Json
          score?: number
          bingo_at?: string | null
        }
        Relationships: []
      }
      bingo_prompts: {
        Row: { id: string; text: string; active: boolean }
        Insert: { id?: string; text: string; active?: boolean }
        Update: { id?: string; text?: string; active?: boolean }
        Relationships: []
      }
      bingo_rooms: {
        Row: {
          id: string
          code: string
          phase: string
          created_at: string
          starts_at: string | null
          phase_started_at: string
          current_round_index: number
          total_rounds: number
          round_duration_seconds: number
          winner_player_id: string | null
          winner_pattern: string | null
          retired: boolean
        }
        Insert: {
          id?: string
          code: string
          phase?: string
          created_at?: string
          starts_at?: string | null
          phase_started_at?: string
          current_round_index?: number
          total_rounds?: number
          round_duration_seconds?: number
          winner_player_id?: string | null
          winner_pattern?: string | null
          retired?: boolean
        }
        Update: {
          id?: string
          code?: string
          phase?: string
          created_at?: string
          starts_at?: string | null
          phase_started_at?: string
          current_round_index?: number
          total_rounds?: number
          round_duration_seconds?: number
          winner_player_id?: string | null
          winner_pattern?: string | null
          retired?: boolean
        }
        Relationships: []
      }
      feud_players: {
        Row: { id: string; room_id: string; team: string; nickname: string; client_token: string; joined_at: string }
        Insert: {
          id?: string
          room_id: string
          team: string
          nickname: string
          client_token?: string
          joined_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          team?: string
          nickname?: string
          client_token?: string
          joined_at?: string
        }
        Relationships: []
      }
      feud_questions: {
        Row: { id: string; prompt: string; answers: Json; last_used_at: string | null }
        Insert: { id?: string; prompt: string; answers: Json; last_used_at?: string | null }
        Update: { id?: string; prompt?: string; answers?: Json; last_used_at?: string | null }
        Relationships: []
      }
      feud_rooms: {
        Row: {
          id: string
          code: string
          phase: string
          created_at: string
          starts_at: string | null
          phase_started_at: string
          last_action_at: string
          current_round_index: number
          total_rounds: number
          current_question_id: string | null
          current_prompt: string | null
          board: Json
          controlling_team: string | null
          strikes: number
          pot: number
          team_a_name: string
          team_b_name: string
          team_a_score: number
          team_b_score: number
          last_guess: Json | null
          retired: boolean
          last_round_winner: string | null
          last_round_points: number | null
          last_round_was_fast_money: boolean
          fast_money_played: boolean
          fast_money_team: string | null
          fast_money_player1_id: string | null
          fast_money_player2_id: string | null
          fast_money_questions: Json | null
          fast_money_turn: number | null
          fast_money_current_index: number | null
          fast_money_current_prompt: string | null
          fast_money_turn_started_at: string | null
          fast_money_prompts: Json | null
          fast_money_answers: Json
          fast_money_total: number | null
        }
        Insert: {
          id?: string
          code: string
          phase?: string
          created_at?: string
          starts_at?: string | null
          phase_started_at?: string
          last_action_at?: string
          current_round_index?: number
          total_rounds?: number
          current_question_id?: string | null
          current_prompt?: string | null
          board?: Json
          controlling_team?: string | null
          strikes?: number
          pot?: number
          team_a_name?: string
          team_b_name?: string
          team_a_score?: number
          team_b_score?: number
          last_guess?: Json | null
          retired?: boolean
          last_round_winner?: string | null
          last_round_points?: number | null
          last_round_was_fast_money?: boolean
          fast_money_played?: boolean
          fast_money_team?: string | null
          fast_money_player1_id?: string | null
          fast_money_player2_id?: string | null
          fast_money_questions?: Json | null
          fast_money_turn?: number | null
          fast_money_current_index?: number | null
          fast_money_current_prompt?: string | null
          fast_money_turn_started_at?: string | null
          fast_money_prompts?: Json | null
          fast_money_answers?: Json
          fast_money_total?: number | null
        }
        Update: {
          id?: string
          code?: string
          phase?: string
          created_at?: string
          starts_at?: string | null
          phase_started_at?: string
          last_action_at?: string
          current_round_index?: number
          total_rounds?: number
          current_question_id?: string | null
          current_prompt?: string | null
          board?: Json
          controlling_team?: string | null
          strikes?: number
          pot?: number
          team_a_name?: string
          team_b_name?: string
          team_a_score?: number
          team_b_score?: number
          last_guess?: Json | null
          retired?: boolean
          last_round_winner?: string | null
          last_round_points?: number | null
          last_round_was_fast_money?: boolean
          fast_money_played?: boolean
          fast_money_team?: string | null
          fast_money_player1_id?: string | null
          fast_money_player2_id?: string | null
          fast_money_questions?: Json | null
          fast_money_turn?: number | null
          fast_money_current_index?: number | null
          fast_money_current_prompt?: string | null
          fast_money_turn_started_at?: string | null
          fast_money_prompts?: Json | null
          fast_money_answers?: Json
          fast_money_total?: number | null
        }
        Relationships: []
      }
      players: {
        Row: {
          client_token: string
          id: string
          joined_at: string
          nickname: string
          room_id: string
          score: number
          team_members: string[] | null
        }
        Insert: {
          client_token?: string
          id?: string
          joined_at?: string
          nickname: string
          room_id: string
          score?: number
          team_members?: string[] | null
        }
        Update: {
          client_token?: string
          id?: string
          joined_at?: string
          nickname?: string
          room_id?: string
          score?: number
          team_members?: string[] | null
        }
        Relationships: []
      }
      question_packs: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          choices: Json
          correct_index: number
          id: string
          last_used_at: string | null
          order_index: number
          pack_id: string
          prompt: string
          time_limit_seconds: number
        }
        Insert: {
          choices: Json
          correct_index: number
          id?: string
          last_used_at?: string | null
          order_index: number
          pack_id: string
          prompt: string
          time_limit_seconds?: number
        }
        Update: {
          choices?: Json
          correct_index?: number
          id?: string
          last_used_at?: string | null
          order_index?: number
          pack_id?: string
          prompt?: string
          time_limit_seconds?: number
        }
        Relationships: []
      }
      rooms: {
        Row: {
          category_option_a: string | null
          category_option_b: string | null
          code: string
          created_at: string
          current_question_index: number
          id: string
          phase: string
          phase_started_at: string
          question_started_at: string | null
          retired: boolean
          revealed_correct_index: number | null
          starts_at: string | null
          winning_category_id: string | null
        }
        Insert: {
          category_option_a?: string | null
          category_option_b?: string | null
          code: string
          created_at?: string
          current_question_index?: number
          id?: string
          phase?: string
          phase_started_at?: string
          question_started_at?: string | null
          retired?: boolean
          revealed_correct_index?: number | null
          starts_at?: string | null
          winning_category_id?: string | null
        }
        Update: {
          category_option_a?: string | null
          category_option_b?: string | null
          code?: string
          created_at?: string
          current_question_index?: number
          id?: string
          phase?: string
          phase_started_at?: string
          question_started_at?: string | null
          retired?: boolean
          revealed_correct_index?: number | null
          starts_at?: string | null
          winning_category_id?: string | null
        }
        Relationships: []
      }
      room_hosts: {
        Row: { room_id: string; host_secret: string }
        Insert: { room_id: string; host_secret?: string }
        Update: { room_id?: string; host_secret?: string }
        Relationships: []
      }
      room_questions: {
        Row: { room_id: string; order_index: number; question_id: string }
        Insert: { room_id: string; order_index: number; question_id: string }
        Update: { room_id?: string; order_index?: number; question_id?: string }
        Relationships: []
      }
    }
    Views: {
      questions_public: {
        Row: {
          choices: Json | null
          id: string | null
          order_index: number | null
          pack_id: string | null
          prompt: string | null
          time_limit_seconds: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_phase: {
        Args: { p_action: string; p_host_secret: string; p_room_id: string }
        Returns: undefined
      }
      cast_vote: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_choice: number }
        Returns: undefined
      }
      create_bingo_room: {
        Args: { p_starts_at?: string }
        Returns: { code: string; room_id: string }[]
      }
      create_feud_room: {
        Args: { p_starts_at?: string }
        Returns: { code: string; room_id: string }[]
      }
      create_room: {
        Args: { p_starts_at?: string }
        Returns: { code: string; host_secret: string; room_id: string }[]
      }
      join_bingo_room: {
        Args: { p_code: string; p_nickname: string }
        Returns: { client_token: string; player_id: string; room_id: string }[]
      }
      join_feud_room: {
        Args: { p_code: string; p_nickname: string; p_team?: string }
        Returns: { client_token: string; player_id: string; room_id: string; team: string }[]
      }
      join_room: {
        Args: { p_code: string; p_nickname: string; p_team_members?: string[] }
        Returns: { client_token: string; player_id: string; room_id: string }[]
      }
      mark_bingo_square: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_index: number }
        Returns: { o_marked: Json; o_won: boolean; o_pattern: string | null; o_phase: string }[]
      }
      submit_fast_money_guess: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_guess: string }
        Returns: { o_matched: boolean; o_points: number; o_phase: string }[]
      }
      submit_feud_guess: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_guess: string }
        Returns: {
          o_matched: boolean
          o_points_awarded: number
          o_strikes: number
          o_phase: string
          o_board: Json
        }[]
      }
      start_room: {
        Args: { p_host_secret: string; p_room_id: string }
        Returns: undefined
      }
      submit_answer: {
        Args: {
          p_choice_index: number
          p_client_token: string
          p_player_id: string
          p_question_id: string
          p_room_id: string
        }
        Returns: { correct: boolean; points_awarded: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
