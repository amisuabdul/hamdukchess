export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          created_at: string
          id: number
          payload: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          payload?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          payload?: Json
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status_enum"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status_enum"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_events: {
        Row: {
          by_user: string | null
          created_at: string
          game_id: string
          id: number
          payload: Json
          type: string
        }
        Insert: {
          by_user?: string | null
          created_at?: string
          game_id: string
          id?: number
          payload?: Json
          type: string
        }
        Update: {
          by_user?: string | null
          created_at?: string
          game_id?: string
          id?: number
          payload?: Json
          type?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          black_id: string
          black_rating_before: number | null
          black_rating_delta: number | null
          bot_persona_id: string | null
          chess960_start_fen: string | null
          created_at: string
          draw_offer_at: string | null
          draw_offer_by: string | null
          end_reason: string | null
          ended_at: string | null
          fen: string
          id: string
          increment_sec: number | null
          initial_sec: number | null
          is_bot_game: boolean
          last_clock_update: string | null
          last_move_at: string
          pgn: string
          ply: number
          rated: boolean
          region: string
          result: string | null
          status: string
          takeback_offer_at: string | null
          takeback_offer_by: string | null
          time_black_ms: number | null
          time_control: string
          time_white_ms: number | null
          variant: string
          white_id: string
          white_rating_before: number | null
          white_rating_delta: number | null
          winner_id: string | null
        }
        Insert: {
          black_id: string
          black_rating_before?: number | null
          black_rating_delta?: number | null
          bot_persona_id?: string | null
          chess960_start_fen?: string | null
          created_at?: string
          draw_offer_at?: string | null
          draw_offer_by?: string | null
          end_reason?: string | null
          ended_at?: string | null
          fen?: string
          id?: string
          increment_sec?: number | null
          initial_sec?: number | null
          is_bot_game?: boolean
          last_clock_update?: string | null
          last_move_at?: string
          pgn?: string
          ply?: number
          rated?: boolean
          region?: string
          result?: string | null
          status?: string
          takeback_offer_at?: string | null
          takeback_offer_by?: string | null
          time_black_ms?: number | null
          time_control: string
          time_white_ms?: number | null
          variant?: string
          white_id: string
          white_rating_before?: number | null
          white_rating_delta?: number | null
          winner_id?: string | null
        }
        Update: {
          black_id?: string
          black_rating_before?: number | null
          black_rating_delta?: number | null
          bot_persona_id?: string | null
          chess960_start_fen?: string | null
          created_at?: string
          draw_offer_at?: string | null
          draw_offer_by?: string | null
          end_reason?: string | null
          ended_at?: string | null
          fen?: string
          id?: string
          increment_sec?: number | null
          initial_sec?: number | null
          is_bot_game?: boolean
          last_clock_update?: string | null
          last_move_at?: string
          pgn?: string
          ply?: number
          rated?: boolean
          region?: string
          result?: string | null
          status?: string
          takeback_offer_at?: string | null
          takeback_offer_by?: string | null
          time_black_ms?: number | null
          time_control?: string
          time_white_ms?: number | null
          variant?: string
          white_id?: string
          white_rating_before?: number | null
          white_rating_delta?: number | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_black_id_fkey"
            columns: ["black_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_id_fkey"
            columns: ["white_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          is_priority: boolean
          joined_at: string
          rating: number
          region: string
          time_control: string
          user_id: string
          variant: string
        }
        Insert: {
          is_priority?: boolean
          joined_at?: string
          rating: number
          region?: string
          time_control: string
          user_id: string
          variant?: string
        }
        Update: {
          is_priority?: boolean
          joined_at?: string
          rating?: number
          region?: string
          time_control?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      move_telemetry: {
        Row: {
          created_at: string
          elapsed_ms: number
          game_id: string
          id: number
          ply: number
          user_id: string
        }
        Insert: {
          created_at?: string
          elapsed_ms: number
          game_id: string
          id?: number
          ply: number
          user_id: string
        }
        Update: {
          created_at?: string
          elapsed_ms?: number
          game_id?: string
          id?: number
          ply?: number
          user_id?: string
        }
        Relationships: []
      }
      moves: {
        Row: {
          by_user: string
          created_at: string
          fen: string
          game_id: string
          id: number
          ply: number
          san: string
          uci: string
        }
        Insert: {
          by_user: string
          created_at?: string
          fen: string
          game_id: string
          id?: number
          ply: number
          san: string
          uci: string
        }
        Update: {
          by_user?: string
          created_at?: string
          fen?: string
          game_id?: string
          id?: number
          ply?: number
          san?: string
          uci?: string
        }
        Relationships: [
          {
            foreignKeyName: "moves_by_user_fkey"
            columns: ["by_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event: string
          id: string
          plan_code: string | null
          raw: Json
          reference: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event: string
          id?: string
          plan_code?: string | null
          raw: Json
          reference?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event?: string
          id?: string
          plan_code?: string | null
          raw?: Json
          reference?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          draws: number
          flag_reason: string | null
          flagged_for_review: boolean
          games_played: number
          id: string
          is_guest: boolean
          last_active_at: string
          losses: number
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
          rating: number
          subscription_renews_at: string | null
          subscription_status: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier_enum"]
          username: string
          wins: number
        }
        Insert: {
          country?: string | null
          created_at?: string
          draws?: number
          flag_reason?: string | null
          flagged_for_review?: boolean
          games_played?: number
          id: string
          is_guest?: boolean
          last_active_at?: string
          losses?: number
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          rating?: number
          subscription_renews_at?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          username: string
          wins?: number
        }
        Update: {
          country?: string | null
          created_at?: string
          draws?: number
          flag_reason?: string | null
          flagged_for_review?: boolean
          games_played?: number
          id?: string
          is_guest?: boolean
          last_active_at?: string
          losses?: number
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          rating?: number
          subscription_renews_at?: string | null
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier_enum"]
          username?: string
          wins?: number
        }
        Relationships: []
      }
      puzzle_ratings: {
        Row: {
          attempts: number
          created_at: string
          id: string
          leitner_box: number
          next_due_at: string
          puzzle_id: string
          solved_at: string | null
          success: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          leitner_box?: number
          next_due_at?: string
          puzzle_id: string
          solved_at?: string | null
          success: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          leitner_box?: number
          next_due_at?: string
          puzzle_id?: string
          solved_at?: string | null
          success?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzle_ratings_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
        ]
      }
      puzzle_storm_scores: {
        Row: {
          duration_sec: number
          id: string
          mistakes: number
          mode: string
          played_at: string
          score: number
          solved: number
          user_id: string
        }
        Insert: {
          duration_sec?: number
          id?: string
          mistakes?: number
          mode?: string
          played_at?: string
          score?: number
          solved?: number
          user_id: string
        }
        Update: {
          duration_sec?: number
          id?: string
          mistakes?: number
          mode?: string
          played_at?: string
          score?: number
          solved?: number
          user_id?: string
        }
        Relationships: []
      }
      puzzles: {
        Row: {
          approved: boolean
          created_at: string
          creator_id: string | null
          daily_date: string | null
          fen: string
          id: string
          rating: number
          solution: string[]
          source: string | null
          themes: string[]
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          creator_id?: string | null
          daily_date?: string | null
          fen: string
          id?: string
          rating?: number
          solution: string[]
          source?: string | null
          themes?: string[]
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          creator_id?: string | null
          daily_date?: string | null
          fen?: string
          id?: string
          rating?: number
          solution?: string[]
          source?: string | null
          themes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          bot_games: number
          draws: number
          games_played: number
          id: string
          losses: number
          rating: number
          time_control: string
          updated_at: string
          user_id: string
          variant: string
          wins: number
        }
        Insert: {
          bot_games?: number
          draws?: number
          games_played?: number
          id?: string
          losses?: number
          rating?: number
          time_control: string
          updated_at?: string
          user_id: string
          variant?: string
          wins?: number
        }
        Update: {
          bot_games?: number
          draws?: number
          games_played?: number
          id?: string
          losses?: number
          rating?: number
          time_control?: string
          updated_at?: string
          user_id?: string
          variant?: string
          wins?: number
        }
        Relationships: []
      }
      user_puzzle_stats: {
        Row: {
          best_streak: number
          current_streak: number
          failed_count: number
          last_solved_date: string | null
          rating: number
          solved_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          failed_count?: number
          last_solved_date?: string | null
          rating?: number
          solved_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          current_streak?: number
          failed_count?: number
          last_solved_date?: string | null
          rating?: number
          solved_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_elo:
        | {
            Args: { p_black: string; p_result: string; p_white: string }
            Returns: undefined
          }
        | {
            Args: {
              p_black: string
              p_game_id?: string
              p_result: string
              p_time_control?: string
              p_variant?: string
              p_white: string
            }
            Returns: undefined
          }
      find_or_join_match:
        | {
            Args: {
              p_rating_window?: number
              p_start_fen?: string
              p_time_control: string
              p_variant?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_rating_window?: number
              p_region?: string
              p_start_fen?: string
              p_time_control: string
              p_variant?: string
            }
            Returns: string
          }
      record_bot_game: {
        Args: { p_time_control: string; p_variant?: string }
        Returns: undefined
      }
      submit_puzzle_attempt: {
        Args: { p_puzzle_id: string; p_success: boolean }
        Returns: Json
      }
    }
    Enums: {
      friend_status_enum: "pending" | "accepted" | "blocked"
      subscription_tier_enum: "free" | "plus" | "gold"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      friend_status_enum: ["pending", "accepted", "blocked"],
      subscription_tier_enum: ["free", "plus", "gold"],
    },
  },
} as const
