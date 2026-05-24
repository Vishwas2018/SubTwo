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
      ai_budget_alerts: {
        Row: {
          id: string
          month: string
          level: string
          notified_at: string
        }
        Insert: {
          id?: string
          month: string
          level: string
          notified_at?: string
        }
        Update: {
          id?: string
          month?: string
          level?: string
          notified_at?: string
        }
        Relationships: []
      }
      ai_generations: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          purpose: string
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          purpose: string
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          purpose?: string
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          actual_date: string
          athlete_notes: string | null
          checkpoint_type: string
          created_at: string
          id: string
          pct_deviation: number | null
          plan_id: string
          planned_session_id: string | null
          recommended_action: string | null
          result_seconds: number
          run_id: string | null
          target_seconds: number
          target_week: number
          user_id: string
          verdict: string
        }
        Insert: {
          actual_date: string
          athlete_notes?: string | null
          checkpoint_type: string
          created_at?: string
          id?: string
          pct_deviation?: number | null
          plan_id: string
          planned_session_id?: string | null
          recommended_action?: string | null
          result_seconds: number
          run_id?: string | null
          target_seconds: number
          target_week: number
          user_id: string
          verdict: string
        }
        Update: {
          actual_date?: string
          athlete_notes?: string | null
          checkpoint_type?: string
          created_at?: string
          id?: string
          pct_deviation?: number | null
          plan_id?: string
          planned_session_id?: string | null
          recommended_action?: string | null
          result_seconds?: number
          run_id?: string | null
          target_seconds?: number
          target_week?: number
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoints_planned_session_id_fkey"
            columns: ["planned_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoints_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          energy_1to5: number | null
          id: string
          mood_1to5: number | null
          niggle_today: boolean
          notes: string | null
          resting_hr: number | null
          sleep_hours: number | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          checkin_date: string
          created_at?: string
          energy_1to5?: number | null
          id?: string
          mood_1to5?: number | null
          niggle_today?: boolean
          notes?: string | null
          resting_hr?: number | null
          sleep_hours?: number | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          checkin_date?: string
          created_at?: string
          energy_1to5?: number | null
          id?: string
          mood_1to5?: number | null
          niggle_today?: boolean
          notes?: string | null
          resting_hr?: number | null
          sleep_hours?: number | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string
          connected_at: string
          expires_at: string | null
          external_user_id: string | null
          id: string
          last_sync_at: string | null
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          status: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          expires_at?: string | null
          external_user_id?: string | null
          id?: string
          last_sync_at?: string | null
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          expires_at?: string | null
          external_user_id?: string | null
          id?: string
          last_sync_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          note: string | null
          use_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          note?: string | null
          use_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          note?: string | null
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      niggles: {
        Row: {
          body_part: string
          created_at: string
          id: string
          notes: string | null
          resolved_date: string | null
          severity: number
          started_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_part: string
          created_at?: string
          id?: string
          notes?: string | null
          resolved_date?: string | null
          severity: number
          started_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_part?: string
          created_at?: string
          id?: string
          notes?: string | null
          resolved_date?: string | null
          severity?: number
          started_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "niggles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_adjustments: {
        Row: {
          affected_session_ids: string[] | null
          change_details: Json | null
          change_summary: string
          created_at: string
          id: string
          plan_id: string
          trigger: string
          user_override: boolean
        }
        Insert: {
          affected_session_ids?: string[] | null
          change_details?: Json | null
          change_summary: string
          created_at?: string
          id?: string
          plan_id: string
          trigger: string
          user_override?: boolean
        }
        Update: {
          affected_session_ids?: string[] | null
          change_details?: Json | null
          change_summary?: string
          created_at?: string
          id?: string
          plan_id?: string
          trigger?: string
          user_override?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plan_adjustments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          ai_generation_id: string | null
          created_at: string
          generated_by: string
          id: string
          plan_id: string
          raw_plan_json: Json
          reason: string | null
          version_number: number
        }
        Insert: {
          ai_generation_id?: string | null
          created_at?: string
          generated_by: string
          id?: string
          plan_id: string
          raw_plan_json: Json
          reason?: string | null
          version_number: number
        }
        Update: {
          ai_generation_id?: string | null
          created_at?: string
          generated_by?: string
          id?: string
          plan_id?: string
          raw_plan_json?: Json
          reason?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_ai_generation_id_fkey"
            columns: ["ai_generation_id"]
            isOneToOne: false
            referencedRelation: "ai_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_sessions: {
        Row: {
          checkpoint_type: string | null
          created_at: string
          day_of_week: number
          distance_km: number | null
          focus: string | null
          id: string
          is_checkpoint: boolean
          is_deload: boolean
          notes: string | null
          phase: string
          plan_id: string
          plan_version_id: string
          scheduled_date: string
          session_type: string
          structure: string | null
          target_pace_max: number | null
          target_pace_min: number | null
          week_number: number
        }
        Insert: {
          checkpoint_type?: string | null
          created_at?: string
          day_of_week: number
          distance_km?: number | null
          focus?: string | null
          id?: string
          is_checkpoint?: boolean
          is_deload?: boolean
          notes?: string | null
          phase: string
          plan_id: string
          plan_version_id: string
          scheduled_date: string
          session_type: string
          structure?: string | null
          target_pace_max?: number | null
          target_pace_min?: number | null
          week_number: number
        }
        Update: {
          checkpoint_type?: string | null
          created_at?: string
          day_of_week?: number
          distance_km?: number | null
          focus?: string | null
          id?: string
          is_checkpoint?: boolean
          is_deload?: boolean
          notes?: string | null
          phase?: string
          plan_id?: string
          plan_version_id?: string
          scheduled_date?: string
          session_type?: string
          structure?: string | null
          target_pace_max?: number | null
          target_pace_min?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "planned_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          activated_at: string | null
          baseline_data: Json
          completed_at: string | null
          created_at: string
          current_version_id: string | null
          experience_level: string
          goal_time_seconds: number | null
          id: string
          pace_zones: Json
          race_date: string
          race_distance_km: number
          race_name: string | null
          start_date: string
          status: string
          total_weeks: number
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          baseline_data: Json
          completed_at?: string | null
          created_at?: string
          current_version_id?: string | null
          experience_level: string
          goal_time_seconds?: number | null
          id?: string
          pace_zones: Json
          race_date: string
          race_distance_km: number
          race_name?: string | null
          start_date: string
          status: string
          total_weeks: number
          user_id: string
        }
        Update: {
          activated_at?: string | null
          baseline_data?: Json
          completed_at?: string | null
          created_at?: string
          current_version_id?: string | null
          experience_level?: string
          goal_time_seconds?: number | null
          id?: string
          pace_zones?: Json
          race_date?: string
          race_distance_km?: number
          race_name?: string | null
          start_date?: string
          status?: string
          total_weeks?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_generation_count: number
          created_at: string
          display_name: string | null
          email: string
          id: string
          invite_code_used: string | null
          is_admin: boolean
          is_coach: boolean
          suspended: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          ai_generation_count?: number
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          invite_code_used?: string | null
          is_admin?: boolean
          is_coach?: boolean
          suspended?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          ai_generation_count?: number
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invite_code_used?: string | null
          is_admin?: boolean
          is_coach?: boolean
          suspended?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      run_comments: {
        Row: {
          author_id: string
          comment: string
          created_at: string
          deleted_at: string | null
          id: string
          run_id: string
        }
        Insert: {
          author_id: string
          comment: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          run_id: string
        }
        Update: {
          author_id?: string
          comment?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_comments_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          avg_cadence: number | null
          avg_hr: number | null
          avg_pace_seconds: number | null
          created_at: string
          deleted_at: string | null
          distance_km: number
          duration_seconds: number
          elevation_gain_m: number | null
          external_id: string | null
          felt_easy: boolean | null
          id: string
          max_hr: number | null
          notes: string | null
          planned_session_id: string | null
          raw_data: Json | null
          rpe: number | null
          run_date: string
          shoes: string | null
          source: string
          start_time: string | null
          stitch_occurred: boolean
          stitch_severity: number | null
          user_id: string
          weather: Json | null
        }
        Insert: {
          avg_cadence?: number | null
          avg_hr?: number | null
          avg_pace_seconds?: number | null
          created_at?: string
          deleted_at?: string | null
          distance_km: number
          duration_seconds: number
          elevation_gain_m?: number | null
          external_id?: string | null
          felt_easy?: boolean | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          planned_session_id?: string | null
          raw_data?: Json | null
          rpe?: number | null
          run_date: string
          shoes?: string | null
          source: string
          start_time?: string | null
          stitch_occurred?: boolean
          stitch_severity?: number | null
          user_id: string
          weather?: Json | null
        }
        Update: {
          avg_cadence?: number | null
          avg_hr?: number | null
          avg_pace_seconds?: number | null
          created_at?: string
          deleted_at?: string | null
          distance_km?: number
          duration_seconds?: number
          elevation_gain_m?: number | null
          external_id?: string | null
          felt_easy?: boolean | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          planned_session_id?: string | null
          raw_data?: Json | null
          rpe?: number | null
          run_date?: string
          shoes?: string | null
          source?: string
          start_time?: string | null
          stitch_occurred?: boolean
          stitch_severity?: number | null
          user_id?: string
          weather?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_planned_session_id_fkey"
            columns: ["planned_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viewer_access: {
        Row: {
          accepted_at: string | null
          athlete_id: string
          can_comment: boolean
          id: string
          invite_email: string
          invite_token: string | null
          invited_at: string
          revoked_at: string | null
          status: string
          viewer_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          athlete_id: string
          can_comment?: boolean
          id?: string
          invite_email: string
          invite_token?: string | null
          invited_at?: string
          revoked_at?: string | null
          status?: string
          viewer_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          athlete_id?: string
          can_comment?: boolean
          id?: string
          invite_email?: string
          invite_token?: string | null
          invited_at?: string
          revoked_at?: string | null
          status?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viewer_access_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewer_access_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_plan: {
        Args: { p_plan_id: string; p_user_id: string }
        Returns: undefined
      }
      check_ai_quota: { Args: { p_user_id: string }; Returns: Json }
      check_global_ai_budget: {
        Args: { p_soft_cap?: number; p_hard_cap?: number }
        Returns: Json
      }
      get_monthly_ai_spend: { Args: Record<string, never>; Returns: number }
      try_claim_budget_alert: { Args: { p_level: string }; Returns: boolean }
      compute_checkpoint_verdict: {
        Args: { p_result_seconds: number; p_target_seconds: number }
        Returns: string
      }
      create_plan_version: {
        Args: { p_plan_id: string; p_plan: Json; p_generation_id: string }
        Returns: Json
      }
      match_run_to_planned_session: {
        Args: { p_run_id: string }
        Returns: string
      }
      validate_invite_code: { Args: { p_code: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
