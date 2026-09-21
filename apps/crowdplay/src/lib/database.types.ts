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
      players: {
        Row: {
          client_token: string
          id: string
          joined_at: string
          nickname: string
          room_id: string
          score: number
        }
        Insert: {
          client_token?: string
          id?: string
          joined_at?: string
          nickname: string
          room_id: string
          score?: number
        }
        Update: {
          client_token?: string
          id?: string
          joined_at?: string
          nickname?: string
          room_id?: string
          score?: number
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
          order_index: number
          pack_id: string
          prompt: string
          time_limit_seconds: number
        }
        Insert: {
          choices: Json
          correct_index: number
          id?: string
          order_index: number
          pack_id: string
          prompt: string
          time_limit_seconds?: number
        }
        Update: {
          choices?: Json
          correct_index?: number
          id?: string
          order_index?: number
          pack_id?: string
          prompt?: string
          time_limit_seconds?: number
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          current_question_index: number
          id: string
          phase: string
          question_started_at: string | null
          revealed_correct_index: number | null
          starts_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_question_index?: number
          id?: string
          phase?: string
          question_started_at?: string | null
          revealed_correct_index?: number | null
          starts_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_question_index?: number
          id?: string
          phase?: string
          question_started_at?: string | null
          revealed_correct_index?: number | null
          starts_at?: string | null
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
      create_room: {
        Args: { p_starts_at?: string; p_questions_per_category?: number }
        Returns: { code: string; host_secret: string; room_id: string }[]
      }
      join_room: {
        Args: { p_code: string; p_nickname: string }
        Returns: { client_token: string; player_id: string; room_id: string }[]
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
