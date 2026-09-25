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
      avatars: {
        Row: {
          id: string
          name: string
          emoji: string | null
          image_url: string | null
          price_cents: number
          active: boolean
          sort: number
          created_at: string
        }
        Insert: { id: string; name: string; emoji?: string | null; image_url?: string | null; price_cents?: number; active?: boolean; sort?: number }
        Update: { name?: string; emoji?: string | null; image_url?: string | null; price_cents?: number; active?: boolean; sort?: number }
        Relationships: []
      }
      shoutout_presets: {
        Row: { id: string; text: string; price_cents: number; active: boolean; sort: number }
        Insert: { id: string; text: string; price_cents?: number; active?: boolean; sort?: number }
        Update: { text?: string; price_cents?: number; active?: boolean; sort?: number }
        Relationships: []
      }
      answers: {
        Row: {
          answer_text: string | null
          answered_at: string
          choice_index: number | null
          correct: boolean
          id: string
          player_id: string
          points_awarded: number
          question_id: string
          room_id: string
        }
        Insert: {
          answer_text?: string | null
          answered_at?: string
          choice_index?: number | null
          correct: boolean
          id?: string
          player_id: string
          points_awarded?: number
          question_id: string
          room_id: string
        }
        Update: {
          answer_text?: string | null
          answered_at?: string
          choice_index?: number | null
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
        Row: { room_id: string; player_id: string; choice: number; choice_pack_id: string | null; voted_at: string }
        Insert: {
          room_id: string
          player_id: string
          choice: number
          choice_pack_id?: string | null
          voted_at?: string
        }
        Update: {
          room_id?: string
          player_id?: string
          choice?: number
          choice_pack_id?: string | null
          voted_at?: string
        }
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
          venue_id: string
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
          venue_id?: string
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
          venue_id?: string
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
          venue_id: string
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
          venue_id?: string
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
          venue_id?: string
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
          left_at: string | null
          nickname: string
          room_id: string
          score: number
          team_id: string | null
          avatar_id: string | null
          device_key: string | null
          team_members: string[] | null
        }
        Insert: {
          client_token?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          nickname: string
          room_id: string
          score?: number
          team_id?: string | null
          avatar_id?: string | null
          device_key?: string | null
          team_members?: string[] | null
        }
        Update: {
          client_token?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          nickname?: string
          room_id?: string
          score?: number
          team_id?: string | null
          avatar_id?: string | null
          device_key?: string | null
          team_members?: string[] | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          room_id: string
          name: string
          kind: string
          locked: boolean
          score: number
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          name: string
          kind?: string
          locked?: boolean
          score?: number
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          name?: string
          kind?: string
          locked?: boolean
          score?: number
          created_at?: string
        }
        Relationships: []
      }
      question_packs: {
        Row: {
          category: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          icon?: string | null
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
      venues: {
        Row: {
          id: string
          slug: string
          name: string
          active: boolean
        }
        Insert: {
          id?: string
          slug: string
          name: string
          active?: boolean
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          active?: boolean
        }
        Relationships: []
      }
      rooms: {
        Row: {
          category_option_a: string | null
          category_option_b: string | null
          category_options: string[] | null
          code: string
          created_at: string
          current_question_index: number
          id: string
          phase: string
          phase_started_at: string
          question_started_at: string | null
          retired: boolean
          queued: boolean
          queued_at: string | null
          venue_id: string
          revealed_correct_index: number | null
          starts_at: string | null
          winning_category_id: string | null
        }
        Insert: {
          category_option_a?: string | null
          category_option_b?: string | null
          category_options?: string[] | null
          code: string
          created_at?: string
          current_question_index?: number
          id?: string
          phase?: string
          phase_started_at?: string
          question_started_at?: string | null
          retired?: boolean
          queued?: boolean
          queued_at?: string | null
          venue_id?: string
          revealed_correct_index?: number | null
          starts_at?: string | null
          winning_category_id?: string | null
        }
        Update: {
          category_option_a?: string | null
          category_option_b?: string | null
          category_options?: string[] | null
          code?: string
          created_at?: string
          current_question_index?: number
          id?: string
          phase?: string
          phase_started_at?: string
          question_started_at?: string | null
          retired?: boolean
          queued?: boolean
          queued_at?: string | null
          venue_id?: string
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
      checkin_submit: {
        Args: { p_venue: string; p_name: string; p_contact: string }
        Returns: { o_checkin_id: string; o_returning: boolean; o_already: boolean }[]
      }
      list_avatars: {
        Args: { p_device_key: string }
        Returns: { o_id: string; o_name: string; o_emoji: string | null; o_image_url: string | null; o_price_cents: number; o_owned: boolean }[]
      }
      set_player_avatar: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_avatar_id: string; p_device_key: string }
        Returns: undefined
      }
      send_shoutout: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_preset_id: string }
        Returns: { o_show_at: string }[]
      }
      my_shoutouts_left: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string }
        Returns: { o_preset_id: string; o_text: string; o_left: number }[]
      }
      touch_activity: {
        Args: { p_venue: string }
        Returns: undefined
      }
      link_player_device: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_device_key: string }
        Returns: undefined
      }
      get_trivia_champion: {
        Args: { p_venue: string }
        Returns: {
          o_nickname: string
          o_avatar_id: string | null
          o_emoji: string | null
          o_image_url: string | null
          o_streak: number
          o_last_win: string
        }[]
      }
      get_season_profile: {
        Args: { p_device_key: string; p_venue: string }
        Returns: { o_username: string | null; o_season_month: string; o_resets_at: string }[]
      }
      claim_season_username: {
        Args: { p_device_key: string; p_venue: string; p_username: string }
        Returns: { o_username: string }[]
      }
      get_shoutouts: {
        Args: { p_room_id: string }
        Returns: { o_id: number; o_text: string; o_nickname: string; o_team_name: string | null; o_emoji: string | null; o_image_url: string | null; o_at: string }[]
      }
      get_carousel: {
        Args: { p_venue: string }
        Returns: Json
      }
      start_purchase: {
        Args: {
          p_item_type: string
          p_item_id: string
          p_device_key: string
          p_venue: string
          p_nickname?: string
          p_room_id?: string
          p_player_id?: string
          p_client_token?: string
        }
        Returns: { o_purchase_id: string; o_amount_cents: number; o_item_name: string }[]
      }
      complete_purchase: {
        Args: {
          p_purchase_id: string
          p_secret: string
          p_ok: boolean
          p_provider: string
          p_payment_id?: string
          p_is_test: boolean
          p_error?: string
        }
        Returns: undefined
      }
      trivia_queue: {
        Args: { p_venue_id: string }
        Returns: {
          o_room_id: string
          o_code: string
          o_rounds_to_wait: number
          o_players: number
          o_teams: number
          o_full: boolean
          o_current_phase: string | null
          o_current_question: number | null
          o_current_total: number | null
        }[]
      }
      log_qr_scan: {
        Args: { p_venue: string; p_session_key: string; p_source?: string }
        Returns: undefined
      }
      log_client_error: {
        Args: { p_venue: string; p_source: string; p_message: string; p_detail?: Json }
        Returns: undefined
      }
      screen_heartbeat: {
        Args: { p_venue: string; p_screen_key: string; p_page: string; p_user_agent?: string }
        Returns: { o_screen_id: string; o_venue_name: string }[]
      }
      get_screen_ads: {
        Args: { p_venue: string }
        Returns: {
          o_sponsor_id: string
          o_name: string
          o_headline: string
          o_tagline: string | null
          o_accent: string
          o_slot_type: string
        }[]
      }
      log_ad_play: {
        Args: { p_venue: string; p_screen_key: string; p_sponsor_id: string; p_seconds: number }
        Returns: undefined
      }
      advance_phase: {
        Args: { p_action: string; p_host_secret: string; p_room_id: string }
        Returns: undefined
      }
      cast_vote: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_pack_id: string }
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
        Args: { p_starts_at?: string; p_venue_id?: string }
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
        Args: { p_code: string; p_nickname: string; p_team_id?: string; p_new_team_name?: string }
        Returns: { client_token: string; player_id: string; room_id: string; team_id: string; team_name: string }[]
      }
      cast_team_vote: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_question_id: string; p_answer_text: string }
        Returns: { o_recorded: boolean }[]
      }
      use_team_hint: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_question_id: string }
        Returns: { o_hint: string; o_points_if_right: number }[]
      }
      get_team_hint: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_question_id: string }
        Returns: { o_hint: string }[]
      }
      get_team_progress: {
        Args: { p_room_id: string; p_question_id: string }
        Returns: { o_team_id: string; o_team_name: string; o_locked: boolean; o_voted: number; o_members: number }[]
      }
      get_team_answer_lock: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_question_id: string }
        Returns: { o_locked: boolean; o_answer_text: string | null }[]
      }
      get_team_votes: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string; p_question_id: string }
        Returns: { o_player_id: string; o_answer_text: string }[]
      }
      get_final_recap: {
        Args: { p_room_id: string }
        Returns: {
          o_question_order: number
          o_prompt: string
          o_correct_answer: string
          o_team_id: string | null
          o_team_name: string | null
          o_team_answer: string | null
          o_team_correct: boolean
          o_team_points: number
        }[]
      }
      leave_room: {
        Args: { p_room_id: string; p_player_id: string; p_client_token: string }
        Returns: undefined
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
      restart_trivia_now: {
        Args: { p_venue?: string }
        Returns: { room_id: string; code: string }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
