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
          note: string | null
          player_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          synced_booking_id: string | null
        }
        Insert: {
          camp_id: string
          created_at?: string
          date: string
          id?: string
          note?: string | null
          player_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          synced_booking_id?: string | null
        }
        Update: {
          camp_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          player_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          synced_booking_id?: string | null
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
          {
            foreignKeyName: "attendance_synced_booking_id_fkey"
            columns: ["synced_booking_id"]
            isOneToOne: false
            referencedRelation: "synced_bookings"
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
      camp_financial_overrides: {
        Row: {
          camp_id: string
          id: string
          notes: string | null
          override_club_payment: number | null
          override_club_rate: number | null
          override_payroll: number | null
          override_revenue: number | null
          updated_at: string
        }
        Insert: {
          camp_id: string
          id?: string
          notes?: string | null
          override_club_payment?: number | null
          override_club_rate?: number | null
          override_payroll?: number | null
          override_revenue?: number | null
          updated_at?: string
        }
        Update: {
          camp_id?: string
          id?: string
          notes?: string | null
          override_club_payment?: number | null
          override_club_rate?: number | null
          override_payroll?: number | null
          override_revenue?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_financial_overrides_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: true
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_messages: {
        Row: {
          camp_id: string
          created_at: string
          generated_text: string
          id: string
          template_id: string | null
        }
        Insert: {
          camp_id: string
          created_at?: string
          generated_text: string
          id?: string
          template_id?: string | null
        }
        Update: {
          camp_id?: string
          created_at?: string
          generated_text?: string
          id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camp_messages_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_planning_campaigns: {
        Row: {
          camp_type: string
          created_at: string
          id: string
          notes: string | null
          num_weeks: number
          updated_at: string
          week1_start_date: string
          year: number
        }
        Insert: {
          camp_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          num_weeks?: number
          updated_at?: string
          week1_start_date: string
          year?: number
        }
        Update: {
          camp_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          num_weeks?: number
          updated_at?: string
          week1_start_date?: string
          year?: number
        }
        Relationships: []
      }
      camp_planning_entries: {
        Row: {
          age_group: string | null
          campaign_id: string | null
          club_id: string | null
          club_name: string
          county: string
          created_at: string
          id: string
          linked_camp_id: string | null
          notes: string | null
          status: string
          updated_at: string
          venue: string | null
          week_number: number
          week_start: string
        }
        Insert: {
          age_group?: string | null
          campaign_id?: string | null
          club_id?: string | null
          club_name: string
          county?: string
          created_at?: string
          id?: string
          linked_camp_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
          week_number?: number
          week_start: string
        }
        Update: {
          age_group?: string | null
          campaign_id?: string | null
          club_id?: string | null
          club_name?: string
          county?: string
          created_at?: string
          id?: string
          linked_camp_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
          week_number?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_planning_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "camp_planning_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_planning_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_planning_entries_linked_camp_id_fkey"
            columns: ["linked_camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_week_scores: {
        Row: {
          camp_id: string
          club_score: number
          club_would_return: boolean
          created_at: string
          id: string
          notes: string | null
          parent_score_avg: number
          status: string
          updated_at: string
          week_label: string
        }
        Insert: {
          camp_id: string
          club_score?: number
          club_would_return?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          parent_score_avg?: number
          status?: string
          updated_at?: string
          week_label?: string
        }
        Update: {
          camp_id?: string
          club_score?: number
          club_would_return?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          parent_score_avg?: number
          status?: string
          updated_at?: string
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_week_scores_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camps: {
        Row: {
          age_group: string
          capacity: number
          club_id: string | null
          club_name: string
          county: string
          created_at: string
          daily_end_time: string
          daily_start_time: string
          end_date: string
          id: string
          is_auto_created: boolean
          name: string
          price_per_child: number
          start_date: string
          status: string
          venue: string
        }
        Insert: {
          age_group: string
          capacity?: number
          club_id?: string | null
          club_name: string
          county: string
          created_at?: string
          daily_end_time?: string
          daily_start_time?: string
          end_date: string
          id?: string
          is_auto_created?: boolean
          name: string
          price_per_child?: number
          start_date: string
          status?: string
          venue: string
        }
        Update: {
          age_group?: string
          capacity?: number
          club_id?: string | null
          club_name?: string
          county?: string
          created_at?: string
          daily_end_time?: string
          daily_start_time?: string
          end_date?: string
          id?: string
          is_auto_created?: boolean
          name?: string
          price_per_child?: number
          start_date?: string
          status?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "camps_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
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
      clubs: {
        Row: {
          county: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          county?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      coaches: {
        Row: {
          address: string | null
          can_drive: boolean
          county: string | null
          created_at: string
          daily_rate: number
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          experience_level: string | null
          first_aid_cert_expiry: string | null
          fuel_allowance_eligible: boolean
          full_name: string
          head_coach_daily_rate: number
          home_town: string | null
          id: string
          is_head_coach: boolean
          local_counties: string[] | null
          notes: string | null
          pay_band_notes: string | null
          phone: string
          pickup_locations: string[] | null
          preferred_counties: string[] | null
          preferred_driver_id: string | null
          qualification_level: string | null
          role_type: string | null
          safeguarding_cert_expiry: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          can_drive?: boolean
          county?: string | null
          created_at?: string
          daily_rate?: number
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_level?: string | null
          first_aid_cert_expiry?: string | null
          fuel_allowance_eligible?: boolean
          full_name: string
          head_coach_daily_rate?: number
          home_town?: string | null
          id?: string
          is_head_coach?: boolean
          local_counties?: string[] | null
          notes?: string | null
          pay_band_notes?: string | null
          phone: string
          pickup_locations?: string[] | null
          preferred_counties?: string[] | null
          preferred_driver_id?: string | null
          qualification_level?: string | null
          role_type?: string | null
          safeguarding_cert_expiry?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          can_drive?: boolean
          county?: string | null
          created_at?: string
          daily_rate?: number
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_level?: string | null
          first_aid_cert_expiry?: string | null
          fuel_allowance_eligible?: boolean
          full_name?: string
          head_coach_daily_rate?: number
          home_town?: string | null
          id?: string
          is_head_coach?: boolean
          local_counties?: string[] | null
          notes?: string | null
          pay_band_notes?: string | null
          phone?: string
          pickup_locations?: string[] | null
          preferred_counties?: string[] | null
          preferred_driver_id?: string | null
          qualification_level?: string | null
          role_type?: string | null
          safeguarding_cert_expiry?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_preferred_driver_id_fkey"
            columns: ["preferred_driver_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assignments: {
        Row: {
          camp_id: string | null
          coach_id: string | null
          created_at: string
          equipment_item_id: string
          id: string
          notes: string | null
          quantity_out: number
          quantity_returned: number
        }
        Insert: {
          camp_id?: string | null
          coach_id?: string | null
          created_at?: string
          equipment_item_id: string
          id?: string
          notes?: string | null
          quantity_out?: number
          quantity_returned?: number
        }
        Update: {
          camp_id?: string | null
          coach_id?: string | null
          created_at?: string
          equipment_item_id?: string
          id?: string
          notes?: string | null
          quantity_out?: number
          quantity_returned?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assignments_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_equipment_item_id_fkey"
            columns: ["equipment_item_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_items: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          total_quantity: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          total_quantity?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          total_quantity?: number
        }
        Relationships: []
      }
      fixture_matches: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          created_at: string
          fixture_set_id: string
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_order: number
          round_name: string
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          fixture_set_id: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_order?: number
          round_name?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          fixture_set_id?: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_order?: number
          round_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "fixture_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_matches_fixture_set_id_fkey"
            columns: ["fixture_set_id"]
            isOneToOne: false
            referencedRelation: "fixture_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "fixture_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_sets: {
        Row: {
          camp_id: string
          created_at: string
          format: Database["public"]["Enums"]["fixture_format"]
          id: string
          name: string
        }
        Insert: {
          camp_id: string
          created_at?: string
          format?: Database["public"]["Enums"]["fixture_format"]
          id?: string
          name: string
        }
        Update: {
          camp_id?: string
          created_at?: string
          format?: Database["public"]["Enums"]["fixture_format"]
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_sets_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_teams: {
        Row: {
          colour: string
          created_at: string
          fixture_set_id: string
          id: string
          name: string
        }
        Insert: {
          colour?: string
          created_at?: string
          fixture_set_id: string
          id?: string
          name: string
        }
        Update: {
          colour?: string
          created_at?: string
          fixture_set_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_teams_fixture_set_id_fkey"
            columns: ["fixture_set_id"]
            isOneToOne: false
            referencedRelation: "fixture_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          teams: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          teams?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          teams?: Json
          updated_at?: string
        }
        Relationships: []
      }
      import_errors: {
        Row: {
          camp_name: string | null
          child_first_name: string | null
          child_last_name: string | null
          created_at: string
          error_code: string | null
          error_message: string
          external_booking_id: string | null
          id: string
          raw_row_json: Json | null
          sync_log_id: string | null
        }
        Insert: {
          camp_name?: string | null
          child_first_name?: string | null
          child_last_name?: string | null
          created_at?: string
          error_code?: string | null
          error_message: string
          external_booking_id?: string | null
          id?: string
          raw_row_json?: Json | null
          sync_log_id?: string | null
        }
        Update: {
          camp_name?: string | null
          child_first_name?: string | null
          child_last_name?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string
          external_booking_id?: string | null
          id?: string
          raw_row_json?: Json | null
          sync_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          camp_type: string | null
          cover_title: string | null
          created_at: string
          id: string
          is_template: boolean
          linked_camp_id: string | null
          notes: string | null
          num_days: number
          start_date: string | null
          team_format: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          camp_type?: string | null
          cover_title?: string | null
          created_at?: string
          id?: string
          is_template?: boolean
          linked_camp_id?: string | null
          notes?: string | null
          num_days?: number
          start_date?: string | null
          team_format?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          camp_type?: string | null
          cover_title?: string | null
          created_at?: string
          id?: string
          is_template?: boolean
          linked_camp_id?: string | null
          notes?: string | null
          num_days?: number
          start_date?: string | null
          team_format?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_linked_camp_id_fkey"
            columns: ["linked_camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_blocks: {
        Row: {
          block_title: string
          created_at: string
          day_id: string
          description: string | null
          end_time: string | null
          id: string
          linked_session_plan_id: string | null
          notes: string | null
          sort_order: number
          start_time: string
        }
        Insert: {
          block_title?: string
          created_at?: string
          day_id: string
          description?: string | null
          end_time?: string | null
          id?: string
          linked_session_plan_id?: string | null
          notes?: string | null
          sort_order?: number
          start_time?: string
        }
        Update: {
          block_title?: string
          created_at?: string
          day_id?: string
          description?: string | null
          end_time?: string | null
          id?: string
          linked_session_plan_id?: string | null
          notes?: string | null
          sort_order?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_blocks_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "itinerary_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_blocks_linked_session_plan_id_fkey"
            columns: ["linked_session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_days: {
        Row: {
          created_at: string
          day_number: number
          id: string
          itinerary_id: string
          next_day_reminder: string | null
          setup_notes: string | null
          theme: string | null
          title: string
        }
        Insert: {
          created_at?: string
          day_number?: number
          id?: string
          itinerary_id: string
          next_day_reminder?: string | null
          setup_notes?: string | null
          theme?: string | null
          title?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          itinerary_id?: string
          next_day_reminder?: string | null
          setup_notes?: string | null
          theme?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          created_at: string
          id: string
          message_text: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message_text: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message_text?: string
          name?: string
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
          date_of_birth: string | null
          first_name: string
          guardian_email: string | null
          guardian_phone: string | null
          id: string
          identity_key: string | null
          kit_size: string
          last_name: string
          medical_notes: string | null
          norm_first_name: string | null
          norm_last_name: string | null
          photo_permission: boolean
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          identity_key?: string | null
          kit_size?: string
          last_name: string
          medical_notes?: string | null
          norm_first_name?: string | null
          norm_last_name?: string | null
          photo_permission?: boolean
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          identity_key?: string | null
          kit_size?: string
          last_name?: string
          medical_notes?: string | null
          norm_first_name?: string | null
          norm_last_name?: string | null
          photo_permission?: boolean
        }
        Relationships: []
      }
      private_attendance: {
        Row: {
          child_id: string
          created_at: string
          id: string
          notes: string | null
          session_date: string
          session_group_id: string
          status: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date: string
          session_group_id: string
          status?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          session_group_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_attendance_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "private_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_attendance_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "private_session_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      private_child_assignments: {
        Row: {
          child_id: string
          created_at: string
          id: string
          notes: string | null
          payment_type: string
          session_group_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_type?: string
          session_group_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_type?: string
          session_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_child_assignments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "private_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_child_assignments_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "private_session_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      private_children: {
        Row: {
          created_at: string
          date_of_birth: string | null
          first_name: string
          id: string
          last_name: string
          medical_notes: string | null
          notes: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          id?: string
          last_name: string
          medical_notes?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          last_name?: string
          medical_notes?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          status?: string
        }
        Relationships: []
      }
      private_coach_assignments: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          notes: string | null
          session_group_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          notes?: string | null
          session_group_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          session_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_coach_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_coach_assignments_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "private_session_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      private_payments: {
        Row: {
          amount_due: number
          amount_paid: number
          balance: number
          block_end_date: string | null
          block_start_date: string | null
          child_id: string | null
          created_at: string
          id: string
          notes: string | null
          payer_type: string
          payment_date: string | null
          payment_status: string
          payment_type: string
          session_group_id: string | null
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          balance?: number
          block_end_date?: string | null
          block_start_date?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payer_type?: string
          payment_date?: string | null
          payment_status?: string
          payment_type?: string
          session_group_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          balance?: number
          block_end_date?: string | null
          block_start_date?: string | null
          child_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payer_type?: string
          payment_date?: string | null
          payment_status?: string
          payment_type?: string
          session_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "private_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_payments_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "private_session_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      private_session_groups: {
        Row: {
          age_group: string | null
          block_price_4_week: number | null
          block_price_6_week: number | null
          club_pays: boolean
          club_pays_amount: number | null
          coach_cost_per_session: number | null
          created_at: string
          day_of_week: string
          end_time: string
          group_name: string
          id: string
          max_capacity: number | null
          notes: string | null
          payment_model: string
          single_session_price: number | null
          start_time: string
          status: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          age_group?: string | null
          block_price_4_week?: number | null
          block_price_6_week?: number | null
          club_pays?: boolean
          club_pays_amount?: number | null
          coach_cost_per_session?: number | null
          created_at?: string
          day_of_week?: string
          end_time?: string
          group_name?: string
          id?: string
          max_capacity?: number | null
          notes?: string | null
          payment_model?: string
          single_session_price?: number | null
          start_time?: string
          status?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          age_group?: string | null
          block_price_4_week?: number | null
          block_price_6_week?: number | null
          club_pays?: boolean
          club_pays_amount?: number | null
          coach_cost_per_session?: number | null
          created_at?: string
          day_of_week?: string
          end_time?: string
          group_name?: string
          id?: string
          max_capacity?: number | null
          notes?: string | null
          payment_model?: string
          single_session_price?: number | null
          start_time?: string
          status?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_session_groups_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "private_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      private_session_plan_links: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          session_group_id: string
          session_plan_id: string
          week_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          session_group_id: string
          session_plan_id: string
          week_date: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          session_group_id?: string
          session_plan_id?: string
          week_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_session_plan_links_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "private_session_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_session_plan_links_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      private_venues: {
        Row: {
          address: string | null
          contact_name: string | null
          contact_phone: string | null
          county: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          venue_cost_per_session: number | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          venue_cost_per_session?: number | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          venue_cost_per_session?: number | null
        }
        Relationships: []
      }
      private_weekly_plan_drills: {
        Row: {
          created_at: string
          custom_drill_name: string | null
          duration_minutes: number
          id: string
          notes: string | null
          practice_type: string
          session_plan_id: string | null
          sort_order: number
          weekly_plan_id: string
        }
        Insert: {
          created_at?: string
          custom_drill_name?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          practice_type?: string
          session_plan_id?: string | null
          sort_order?: number
          weekly_plan_id: string
        }
        Update: {
          created_at?: string
          custom_drill_name?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          practice_type?: string
          session_plan_id?: string | null
          sort_order?: number
          weekly_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_weekly_plan_drills_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_weekly_plan_drills_weekly_plan_id_fkey"
            columns: ["weekly_plan_id"]
            isOneToOne: false
            referencedRelation: "private_weekly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      private_weekly_plans: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          programme_type: string
          updated_at: string
          week_date: string | null
          week_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          programme_type?: string
          updated_at?: string
          week_date?: string | null
          week_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          programme_type?: string
          updated_at?: string
          week_date?: string | null
          week_number?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          coach_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          camp_description: string | null
          club_name: string
          created_at: string
          id: string
          notes: string | null
          price_details: string | null
          proposal_title: string
          proposed_dates: string
          status: Database["public"]["Enums"]["proposal_status"]
        }
        Insert: {
          camp_description?: string | null
          club_name: string
          created_at?: string
          id?: string
          notes?: string | null
          price_details?: string | null
          proposal_title: string
          proposed_dates: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Update: {
          camp_description?: string | null
          club_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          price_details?: string | null
          proposal_title?: string
          proposed_dates?: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Relationships: []
      }
      session_plan_assignments: {
        Row: {
          camp_day: string | null
          camp_id: string
          created_at: string
          id: string
          session_plan_id: string
        }
        Insert: {
          camp_day?: string | null
          camp_id: string
          created_at?: string
          id?: string
          session_plan_id: string
        }
        Update: {
          camp_day?: string | null
          camp_id?: string
          created_at?: string
          id?: string
          session_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_plan_assignments_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_plan_assignments_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      session_plan_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      session_plans: {
        Row: {
          age_group: string
          category_id: string | null
          coaching_points: string | null
          content: string | null
          created_at: string
          description: string | null
          diagram_image_url: string | null
          equipment: string | null
          id: string
          organisation: string | null
          other_comments: string | null
          player_numbers: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          age_group?: string
          category_id?: string | null
          coaching_points?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          diagram_image_url?: string | null
          equipment?: string | null
          id?: string
          organisation?: string | null
          other_comments?: string | null
          player_numbers?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          age_group?: string
          category_id?: string | null
          coaching_points?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          diagram_image_url?: string | null
          equipment?: string | null
          id?: string
          organisation?: string | null
          other_comments?: string | null
          player_numbers?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "session_plan_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_week_points: {
        Row: {
          attendance_complete: boolean
          camp_id: string
          coach_id: string
          created_at: string
          hc_rating_score: number | null
          id: string
          notes: string | null
          role_that_week: string
          week_label: string
        }
        Insert: {
          attendance_complete?: boolean
          camp_id: string
          coach_id: string
          created_at?: string
          hc_rating_score?: number | null
          id?: string
          notes?: string | null
          role_that_week?: string
          week_label?: string
        }
        Update: {
          attendance_complete?: boolean
          camp_id?: string
          coach_id?: string
          created_at?: string
          hc_rating_score?: number | null
          id?: string
          notes?: string | null
          role_that_week?: string
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_week_points_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_week_points_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          error_notes: string | null
          id: string
          records_created: number
          records_failed: number
          records_processed: number
          records_updated: number
          source_system: string
          status: string
          sync_completed_at: string | null
          sync_started_at: string
        }
        Insert: {
          created_at?: string
          error_notes?: string | null
          id?: string
          records_created?: number
          records_failed?: number
          records_processed?: number
          records_updated?: number
          source_system?: string
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
        }
        Update: {
          created_at?: string
          error_notes?: string | null
          id?: string
          records_created?: number
          records_failed?: number
          records_processed?: number
          records_updated?: number
          source_system?: string
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
        }
        Relationships: []
      }
      synced_bookings: {
        Row: {
          age: number | null
          alternate_phone: string | null
          amount_owed: number | null
          amount_paid: number | null
          booking_date: string | null
          booking_status: string | null
          camp_date: string | null
          camp_name: string
          child_first_name: string
          child_last_name: string
          county: string | null
          created_at: string
          date_of_birth: string | null
          duplicate_warning: boolean
          emergency_contact: string | null
          external_booking_id: string | null
          id: string
          imported_at: string
          kit_given: boolean
          kit_size: string | null
          last_synced_at: string
          manual_override: boolean
          match_reason: string | null
          match_score: number | null
          match_status: string
          matched_booking_id: string | null
          matched_camp_id: string | null
          matched_player_id: string | null
          medical_condition: string | null
          medical_notes: string | null
          notes: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          payment_status: string | null
          payment_type: string | null
          photo_permission: boolean | null
          refund_amount: number | null
          sibling_discount: number | null
          source_system: string
          staff_notes: string | null
          sync_log_id: string | null
          total_amount: number | null
          venue: string | null
        }
        Insert: {
          age?: number | null
          alternate_phone?: string | null
          amount_owed?: number | null
          amount_paid?: number | null
          booking_date?: string | null
          booking_status?: string | null
          camp_date?: string | null
          camp_name: string
          child_first_name: string
          child_last_name: string
          county?: string | null
          created_at?: string
          date_of_birth?: string | null
          duplicate_warning?: boolean
          emergency_contact?: string | null
          external_booking_id?: string | null
          id?: string
          imported_at?: string
          kit_given?: boolean
          kit_size?: string | null
          last_synced_at?: string
          manual_override?: boolean
          match_reason?: string | null
          match_score?: number | null
          match_status?: string
          matched_booking_id?: string | null
          matched_camp_id?: string | null
          matched_player_id?: string | null
          medical_condition?: string | null
          medical_notes?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          payment_status?: string | null
          payment_type?: string | null
          photo_permission?: boolean | null
          refund_amount?: number | null
          sibling_discount?: number | null
          source_system?: string
          staff_notes?: string | null
          sync_log_id?: string | null
          total_amount?: number | null
          venue?: string | null
        }
        Update: {
          age?: number | null
          alternate_phone?: string | null
          amount_owed?: number | null
          amount_paid?: number | null
          booking_date?: string | null
          booking_status?: string | null
          camp_date?: string | null
          camp_name?: string
          child_first_name?: string
          child_last_name?: string
          county?: string | null
          created_at?: string
          date_of_birth?: string | null
          duplicate_warning?: boolean
          emergency_contact?: string | null
          external_booking_id?: string | null
          id?: string
          imported_at?: string
          kit_given?: boolean
          kit_size?: string | null
          last_synced_at?: string
          manual_override?: boolean
          match_reason?: string | null
          match_score?: number | null
          match_status?: string
          matched_booking_id?: string | null
          matched_camp_id?: string | null
          matched_player_id?: string | null
          medical_condition?: string | null
          medical_notes?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          payment_status?: string | null
          payment_type?: string | null
          photo_permission?: boolean | null
          refund_amount?: number | null
          sibling_discount?: number | null
          source_system?: string
          staff_notes?: string | null
          sync_log_id?: string | null
          total_amount?: number | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "synced_bookings_matched_booking_id_fkey"
            columns: ["matched_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_bookings_matched_camp_id_fkey"
            columns: ["matched_camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_bookings_matched_player_id_fkey"
            columns: ["matched_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_bookings_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          linked_area: string | null
          linked_camp_id: string | null
          linked_coach_id: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          linked_area?: string | null
          linked_camp_id?: string | null
          linked_coach_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          linked_area?: string | null
          linked_camp_id?: string | null
          linked_coach_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_linked_camp_id_fkey"
            columns: ["linked_camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_coach_id_fkey"
            columns: ["linked_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_rosters: {
        Row: {
          assignments: Json
          available_coach_ids: Json
          camps_count: number
          coaches_count: number
          created_at: string
          id: string
          status: Database["public"]["Enums"]["roster_status"]
          updated_at: string
          week_start: string
        }
        Insert: {
          assignments?: Json
          available_coach_ids?: Json
          camps_count?: number
          coaches_count?: number
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["roster_status"]
          updated_at?: string
          week_start: string
        }
        Update: {
          assignments?: Json
          available_coach_ids?: Json
          camps_count?: number
          coaches_count?: number
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["roster_status"]
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_payment_status: {
        Args: never
        Returns: {
          paid: number
          partial: number
          pending: number
          refunded: number
          updated: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "head_coach"
      attendance_status: "present" | "absent"
      coach_role: "head_coach" | "assistant"
      fixture_format: "group_stage" | "knockout" | "group_knockout"
      invoice_status: "draft" | "ready" | "sent" | "paid"
      payment_status: "paid" | "pending" | "refunded"
      proposal_status: "draft" | "sent" | "accepted" | "rejected"
      roster_status: "draft" | "finalised"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "to_do" | "in_progress" | "done" | "overdue"
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
      app_role: ["admin", "head_coach"],
      attendance_status: ["present", "absent"],
      coach_role: ["head_coach", "assistant"],
      fixture_format: ["group_stage", "knockout", "group_knockout"],
      invoice_status: ["draft", "ready", "sent", "paid"],
      payment_status: ["paid", "pending", "refunded"],
      proposal_status: ["draft", "sent", "accepted", "rejected"],
      roster_status: ["draft", "finalised"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["to_do", "in_progress", "done", "overdue"],
    },
  },
} as const
