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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          camp_id: string
          created_at: string
          date: string
          id: string
          player_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          camp_id: string
          created_at?: string
          date: string
          id?: string
          player_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          camp_id?: string
          created_at?: string
          date?: string
          id?: string
          player_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          camp_id: string
          created_at: string
          id: string
          parent_email: string
          parent_name: string
          parent_phone: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          player_id: string
        }
        Insert: {
          camp_id: string
          created_at?: string
          id?: string
          parent_email: string
          parent_name: string
          parent_phone: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          player_id: string
        }
        Update: {
          camp_id?: string
          created_at?: string
          id?: string
          parent_email?: string
          parent_name?: string
          parent_phone?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_coach_assignments: {
        Row: {
          camp_id: string
          coach_id: string
          created_at: string
          id: string
          notes: string | null
          role: Database["public"]["Enums"]["coach_role"]
        }
        Insert: {
          camp_id: string
          coach_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["coach_role"]
        }
        Update: {
          camp_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["coach_role"]
        }
        Relationships: [
          {
            foreignKeyName: "camp_coach_assignments_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_coach_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      camps: {
        Row: {
          age_group: string
          capacity: number
          club_name: string
          county: string
          created_at: string
          daily_end_time: string
          daily_start_time: string
          end_date: string
          id: string
          name: string
          price_per_child: number
          start_date: string
          venue: string
        }
        Insert: {
          age_group: string
          capacity?: number
          club_name: string
          county: string
          created_at?: string
          daily_end_time?: string
          daily_start_time?: string
          end_date: string
          id?: string
          name: string
          price_per_child?: number
          start_date: string
          venue: string
        }
        Update: {
          age_group?: string
          capacity?: number
          club_name?: string
          county?: string
          created_at?: string
          daily_end_time?: string
          daily_start_time?: string
          end_date?: string
          id?: string
          name?: string
          price_per_child?: number
          start_date?: string
          venue?: string
        }
        Relationships: []
      }
      club_invoices: {
        Row: {
          attendance_count: number
          camp_id: string
          club_name: string
          created_at: string
          id: string
          manual_amount: number | null
          notes: string | null
          rate_per_child: number
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
        }
        Insert: {
          attendance_count?: number
          camp_id: string
          club_name: string
          created_at?: string
          id?: string
          manual_amount?: number | null
          notes?: string | null
          rate_per_child?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
        }
        Update: {
          attendance_count?: number
          camp_id?: string
          club_name?: string
          created_at?: string
          id?: string
          manual_amount?: number | null
          notes?: string | null
          rate_per_child?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_invoices_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          can_drive: boolean
          created_at: string
          daily_rate: number
          email: string
          fuel_allowance_eligible: boolean
          full_name: string
          head_coach_daily_rate: number
          id: string
          is_head_coach: boolean
          notes: string | null
          phone: string
        }
        Insert: {
          can_drive?: boolean
          created_at?: string
          daily_rate?: number
          email: string
          fuel_allowance_eligible?: boolean
          full_name: string
          head_coach_daily_rate?: number
          id?: string
          is_head_coach?: boolean
          notes?: string | null
          phone: string
        }
        Update: {
          can_drive?: boolean
          created_at?: string
          daily_rate?: number
          email?: string
          fuel_allowance_eligible?: boolean
          full_name?: string
          head_coach_daily_rate?: number
          id?: string
          is_head_coach?: boolean
          notes?: string | null
          phone?: string
        }
        Relationships: []
      }
      payroll_records: {
        Row: {
          camp_id: string
          coach_id: string
          created_at: string
          daily_rate_used: number
          days_worked: number
          fuel_allowance: number
          id: string
          manual_adjustment: number
          notes: string | null
          total_amount: number
          week_start: string
        }
        Insert: {
          camp_id: string
          coach_id: string
          created_at?: string
          daily_rate_used?: number
          days_worked?: number
          fuel_allowance?: number
          id?: string
          manual_adjustment?: number
          notes?: string | null
          total_amount?: number
          week_start: string
        }
        Update: {
          camp_id?: string
          coach_id?: string
          created_at?: string
          daily_rate_used?: number
          days_worked?: number
          fuel_allowance?: number
          id?: string
          manual_adjustment?: number
          notes?: string | null
          total_amount?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          date_of_birth: string
          first_name: string
          id: string
          kit_size: string
          last_name: string
          medical_notes: string | null
          photo_permission: boolean
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          first_name: string
          id?: string
          kit_size?: string
          last_name: string
          medical_notes?: string | null
          photo_permission?: boolean
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          first_name?: string
          id?: string
          kit_size?: string
          last_name?: string
          medical_notes?: string | null
          photo_permission?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attendance_status: "present" | "absent"
      coach_role: "head_coach" | "assistant"
      invoice_status: "draft" | "sent" | "paid"
      payment_status: "paid" | "pending" | "refunded"
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
      attendance_status: ["present", "absent"],
      coach_role: ["head_coach", "assistant"],
      invoice_status: ["draft", "sent", "paid"],
      payment_status: ["paid", "pending", "refunded"],
    },
  },
} as const
