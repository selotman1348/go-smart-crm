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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"][]
          address_line1: string | null
          address_line2: string | null
          city: string | null
          client_code: string | null
          country: string | null
          created_at: string
          created_by: string | null
          discount_pct: number | null
          email: string | null
          id: string
          invoicing_conditions: string | null
          is_network_member: boolean
          name: string
          parent_account_id: string | null
          phone: string | null
          postcode: string | null
          requires_vda_po: boolean
          updated_at: string
          updated_by: string | null
          vat_liable: boolean
          vat_number: string | null
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"][]
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          email?: string | null
          id?: string
          invoicing_conditions?: string | null
          is_network_member?: boolean
          name: string
          parent_account_id?: string | null
          phone?: string | null
          postcode?: string | null
          requires_vda_po?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_liable?: boolean
          vat_number?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"][]
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          email?: string | null
          id?: string
          invoicing_conditions?: string | null
          is_network_member?: boolean
          name?: string
          parent_account_id?: string | null
          phone?: string | null
          postcode?: string | null
          requires_vda_po?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_liable?: boolean
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      api_client: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          name: string
          scopes: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          name: string
          scopes?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          name?: string
          scopes?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_client_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_client_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          signature: string | null
          updated_at: string
          updated_by: string | null
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id: string
          signature?: string | null
          updated_at?: string
          updated_by?: string | null
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          signature?: string | null
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment: {
        Row: {
          approved_amount_excl_vat: number | null
          approved_amount_incl_vat: number | null
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          case_id: string
          created_at: string
          created_by: string | null
          expert_account_id: string | null
          expert_report_document_id: string | null
          id: string
          loss_of_use_days: number | null
          total_loss_accessories: number | null
          total_loss_damage_amount: number | null
          total_loss_previous_damage_deduction: number | null
          total_loss_vehicle_value: number | null
          total_loss_wreck_value: number | null
          updated_at: string
          updated_by: string | null
          validated_at: string | null
          validated_by: string | null
          vat_applicable: boolean | null
        }
        Insert: {
          approved_amount_excl_vat?: number | null
          approved_amount_incl_vat?: number | null
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          case_id: string
          created_at?: string
          created_by?: string | null
          expert_account_id?: string | null
          expert_report_document_id?: string | null
          id?: string
          loss_of_use_days?: number | null
          total_loss_accessories?: number | null
          total_loss_damage_amount?: number | null
          total_loss_previous_damage_deduction?: number | null
          total_loss_vehicle_value?: number | null
          total_loss_wreck_value?: number | null
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          vat_applicable?: boolean | null
        }
        Update: {
          approved_amount_excl_vat?: number | null
          approved_amount_incl_vat?: number | null
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          case_id?: string
          created_at?: string
          created_by?: string | null
          expert_account_id?: string | null
          expert_report_document_id?: string | null
          id?: string
          loss_of_use_days?: number | null
          total_loss_accessories?: number | null
          total_loss_damage_amount?: number | null
          total_loss_previous_damage_deduction?: number | null
          total_loss_vehicle_value?: number | null
          total_loss_wreck_value?: number | null
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          vat_applicable?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "assessment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_expert_account_id_fkey"
            columns: ["expert_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_expert_report_document_id_fkey"
            columns: ["expert_report_document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          at: string
          case_id: string | null
          created_at: string
          created_by: string | null
          entity: string
          entity_id: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          at?: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          entity: string
          entity_id: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          at?: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          entity?: string
          entity_id?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "audit_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      case: {
        Row: {
          appointment_estimate_at: string | null
          appointment_repair_at: string | null
          assigned_to_user_id: string | null
          assignment_date: string | null
          broker_ref: string | null
          case_number: string
          client_account_id: string
          client_notified_date: string | null
          collected_date: string | null
          completion_date: string | null
          cover_type: string | null
          created_at: string
          created_by: string | null
          deductible: number | null
          delivered_date: string | null
          expert_ref: string | null
          id: string
          insurer_ref: string | null
          leasing_ref: string | null
          manager_user_id: string | null
          no_repair_reason: string | null
          no_repair_reason_text: string | null
          on_hold: boolean
          on_hold_reason: string | null
          on_hold_reason_text: string | null
          po_number: string | null
          policy_number: string | null
          repair_decision: Database["public"]["Enums"]["repair_decision"] | null
          status: Database["public"]["Enums"]["case_status"]
          updated_at: string
          updated_by: string | null
          vat_liable_pct: number | null
          vda_number: string | null
          vehicle_id: string | null
          vehicle_in_date: string | null
          vehicle_out_date: string | null
          vehicle_ready_date: string | null
        }
        Insert: {
          appointment_estimate_at?: string | null
          appointment_repair_at?: string | null
          assigned_to_user_id?: string | null
          assignment_date?: string | null
          broker_ref?: string | null
          case_number: string
          client_account_id: string
          client_notified_date?: string | null
          collected_date?: string | null
          completion_date?: string | null
          cover_type?: string | null
          created_at?: string
          created_by?: string | null
          deductible?: number | null
          delivered_date?: string | null
          expert_ref?: string | null
          id?: string
          insurer_ref?: string | null
          leasing_ref?: string | null
          manager_user_id?: string | null
          no_repair_reason?: string | null
          no_repair_reason_text?: string | null
          on_hold?: boolean
          on_hold_reason?: string | null
          on_hold_reason_text?: string | null
          po_number?: string | null
          policy_number?: string | null
          repair_decision?:
            | Database["public"]["Enums"]["repair_decision"]
            | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          updated_by?: string | null
          vat_liable_pct?: number | null
          vda_number?: string | null
          vehicle_id?: string | null
          vehicle_in_date?: string | null
          vehicle_out_date?: string | null
          vehicle_ready_date?: string | null
        }
        Update: {
          appointment_estimate_at?: string | null
          appointment_repair_at?: string | null
          assigned_to_user_id?: string | null
          assignment_date?: string | null
          broker_ref?: string | null
          case_number?: string
          client_account_id?: string
          client_notified_date?: string | null
          collected_date?: string | null
          completion_date?: string | null
          cover_type?: string | null
          created_at?: string
          created_by?: string | null
          deductible?: number | null
          delivered_date?: string | null
          expert_ref?: string | null
          id?: string
          insurer_ref?: string | null
          leasing_ref?: string | null
          manager_user_id?: string | null
          no_repair_reason?: string | null
          no_repair_reason_text?: string | null
          on_hold?: boolean
          on_hold_reason?: string | null
          on_hold_reason_text?: string | null
          po_number?: string | null
          policy_number?: string | null
          repair_decision?:
            | Database["public"]["Enums"]["repair_decision"]
            | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          updated_by?: string | null
          vat_liable_pct?: number | null
          vda_number?: string | null
          vehicle_id?: string | null
          vehicle_in_date?: string | null
          vehicle_out_date?: string | null
          vehicle_ready_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_no_repair_reason_fkey"
            columns: ["no_repair_reason"]
            isOneToOne: false
            referencedRelation: "no_repair_reason"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "case_on_hold_reason_fkey"
            columns: ["on_hold_reason"]
            isOneToOne: false
            referencedRelation: "on_hold_reason"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "case_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle"
            referencedColumns: ["id"]
          },
        ]
      }
      case_communication: {
        Row: {
          case_id: string
          communication_id: string
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id: string
          communication_id: string
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          communication_id?: string
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_communication_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_communication_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_communication_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_communication_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_communication_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      case_party: {
        Row: {
          account_id: string | null
          case_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_invoice_party: boolean | null
          role: Database["public"]["Enums"]["party_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          case_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_invoice_party?: boolean | null
          role: Database["public"]["Enums"]["party_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          case_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_invoice_party?: boolean | null
          role?: Database["public"]["Enums"]["party_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_party_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_party_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_party_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_party_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_party_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_party_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tag: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          tag_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          tag_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          tag_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_tag_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tag_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_tag_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tag_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tag_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      circumstances: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circumstances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circumstances_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      communication: {
        Row: {
          bcc_addresses: string[]
          body: string | null
          cc_addresses: string[]
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["communication_direction"]
          from_address: string | null
          id: string
          language: string | null
          processed: boolean
          sent_at: string | null
          subject: string | null
          template_id: string | null
          to_addresses: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bcc_addresses?: string[]
          body?: string | null
          cc_addresses?: string[]
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["communication_direction"]
          from_address?: string | null
          id?: string
          language?: string | null
          processed?: boolean
          sent_at?: string | null
          subject?: string | null
          template_id?: string | null
          to_addresses?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bcc_addresses?: string[]
          body?: string | null
          cc_addresses?: string[]
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["communication_direction"]
          from_address?: string | null
          id?: string
          language?: string | null
          processed?: boolean
          sent_at?: string | null
          subject?: string | null
          template_id?: string | null
          to_addresses?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      completeness_rule: {
        Row: {
          active: boolean
          client_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          requirement: string
          stage: Database["public"]["Enums"]["completeness_stage"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          client_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          requirement: string
          stage: Database["public"]["Enums"]["completeness_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          client_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          requirement?: string
          stage?: Database["public"]["Enums"]["completeness_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "completeness_rule_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completeness_rule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completeness_rule_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      contact: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string
          phone: string | null
          salutation: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name: string
          phone?: string | null
          salutation?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          salutation?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      damage: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          case_id: string
          cause: string | null
          circumstances: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          damage_date: string | null
          extra_info: string | null
          id: string
          liability: string | null
          mileage_in: number | null
          mileage_out: number | null
          postcode: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          case_id: string
          cause?: string | null
          circumstances?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          damage_date?: string | null
          extra_info?: string | null
          id?: string
          liability?: string | null
          mileage_in?: number | null
          mileage_out?: number | null
          postcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          case_id?: string
          cause?: string | null
          circumstances?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          damage_date?: string | null
          extra_info?: string | null
          id?: string
          liability?: string | null
          mileage_in?: number | null
          mileage_out?: number | null
          postcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "damage_circumstances_fkey"
            columns: ["circumstances"]
            isOneToOne: false
            referencedRelation: "circumstances"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "damage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_liability_fkey"
            columns: ["liability"]
            isOneToOne: false
            referencedRelation: "liability"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "damage_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      damaged_part: {
        Row: {
          created_at: string
          created_by: string | null
          damage_id: string
          part_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          damage_id: string
          part_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          damage_id?: string
          part_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damaged_part_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_part_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_part_part_code_fkey"
            columns: ["part_code"]
            isOneToOne: false
            referencedRelation: "part_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "damaged_part_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      document: {
        Row: {
          case_id: string | null
          category: Database["public"]["Enums"]["document_category"]
          communication_id: string | null
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          mime_type: string | null
          size: number | null
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id?: string | null
          category?: Database["public"]["Enums"]["document_category"]
          communication_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string | null
          category?: Database["public"]["Enums"]["document_category"]
          communication_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "document_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template: {
        Row: {
          audience: string | null
          body: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          language: string
          name: string
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience?: string | null
          body: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          language: string
          name: string
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string | null
          body?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_template_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_template_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      event: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          delivered: boolean
          id: string
          payload: Json
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered?: boolean
          id?: string
          payload?: Json
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered?: boolean
          id?: string
          payload?: Json
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "event_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_attachment: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          inbound_email_id: string
          mime_type: string | null
          size: number | null
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          inbound_email_id: string
          mime_type?: string | null
          size?: number | null
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          inbound_email_id?: string
          mime_type?: string | null
          size?: number | null
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_attachment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_attachment_inbound_email_id_fkey"
            columns: ["inbound_email_id"]
            isOneToOne: false
            referencedRelation: "inbound_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_attachment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_email: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_addresses: string[]
          created_at: string
          created_by: string | null
          from_address: string | null
          id: string
          linked_case_id: string | null
          message_id: string | null
          parse_status: Database["public"]["Enums"]["inbound_parse_status"]
          raw_storage_path: string | null
          received_at: string
          subject: string | null
          to_addresses: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[]
          created_at?: string
          created_by?: string | null
          from_address?: string | null
          id?: string
          linked_case_id?: string | null
          message_id?: string | null
          parse_status?: Database["public"]["Enums"]["inbound_parse_status"]
          raw_storage_path?: string | null
          received_at?: string
          subject?: string | null
          to_addresses?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[]
          created_at?: string
          created_by?: string | null
          from_address?: string | null
          id?: string
          linked_case_id?: string | null
          message_id?: string | null
          parse_status?: Database["public"]["Enums"]["inbound_parse_status"]
          raw_storage_path?: string | null
          received_at?: string
          subject?: string | null
          to_addresses?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_email_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_email_linked_case_id_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_email_linked_case_id_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "inbound_email_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_draft: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          field_confidence: Json
          id: string
          missing_fields: string[]
          proposed_fields: Json
          source_email_id: string
          status: Database["public"]["Enums"]["intake_draft_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          field_confidence?: Json
          id?: string
          missing_fields?: string[]
          proposed_fields?: Json
          source_email_id: string
          status?: Database["public"]["Enums"]["intake_draft_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          field_confidence?: Json
          id?: string
          missing_fields?: string[]
          proposed_fields?: Json
          source_email_id?: string
          status?: Database["public"]["Enums"]["intake_draft_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_draft_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_draft_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "intake_draft_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_draft_source_email_id_fkey"
            columns: ["source_email_id"]
            isOneToOne: true
            referencedRelation: "inbound_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_draft_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice: {
        Row: {
          amount_excl_vat: number | null
          case_id: string
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["invoice_direction"]
          document_id: string | null
          id: string
          invoice_number: string | null
          received: boolean
          received_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_excl_vat?: number | null
          case_id: string
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["invoice_direction"]
          document_id?: string | null
          id?: string
          invoice_number?: string | null
          received?: boolean
          received_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_excl_vat?: number | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["invoice_direction"]
          document_id?: string | null
          id?: string
          invoice_number?: string | null
          received?: boolean
          received_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "invoice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      liability: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      no_repair_reason: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "no_repair_reason_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_repair_reason_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      on_hold_reason: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "on_hold_reason_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_hold_reason_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_message: {
        Row: {
          approved_by: string | null
          body: string | null
          case_id: string
          cc_addresses: string[]
          created_at: string
          created_by: string | null
          id: string
          merge_data: Json
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_message_status"]
          subject: string | null
          template_id: string | null
          to_addresses: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_by?: string | null
          body?: string | null
          case_id: string
          cc_addresses?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          merge_data?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_message_status"]
          subject?: string | null
          template_id?: string | null
          to_addresses?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_by?: string | null
          body?: string | null
          case_id?: string
          cc_addresses?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          merge_data?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_message_status"]
          subject?: string | null
          template_id?: string | null
          to_addresses?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_message_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_message_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_message_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "outbound_message_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_message_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_message_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      part_catalog: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_catalog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_catalog_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      quote: {
        Row: {
          case_id: string
          copied_from_quote_id: string | null
          created_at: string
          created_by: string | null
          generated_by: string | null
          hourly_rate_assembly: number | null
          hourly_rate_paint: number | null
          id: string
          model_version: string | null
          origin: Database["public"]["Enums"]["quote_origin"]
          rationale: string | null
          status: Database["public"]["Enums"]["quote_status"]
          total_excl_vat: number
          updated_at: string
          updated_by: string | null
          version: Database["public"]["Enums"]["quote_version"]
        }
        Insert: {
          case_id: string
          copied_from_quote_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string | null
          hourly_rate_assembly?: number | null
          hourly_rate_paint?: number | null
          id?: string
          model_version?: string | null
          origin?: Database["public"]["Enums"]["quote_origin"]
          rationale?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_excl_vat?: number
          updated_at?: string
          updated_by?: string | null
          version: Database["public"]["Enums"]["quote_version"]
        }
        Update: {
          case_id?: string
          copied_from_quote_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string | null
          hourly_rate_assembly?: number | null
          hourly_rate_paint?: number | null
          id?: string
          model_version?: string | null
          origin?: Database["public"]["Enums"]["quote_origin"]
          rationale?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_excl_vat?: number
          updated_at?: string
          updated_by?: string | null
          version?: Database["public"]["Enums"]["quote_version"]
        }
        Relationships: [
          {
            foreignKeyName: "quote_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "quote_copied_from_quote_id_fkey"
            columns: ["copied_from_quote_id"]
            isOneToOne: false
            referencedRelation: "quote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_copied_from_quote_id_fkey"
            columns: ["copied_from_quote_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_copied_from_quote_id_fkey"
            columns: ["copied_from_quote_id"]
            isOneToOne: false
            referencedRelation: "repairer_hourly_rate"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["quote_line_category"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          quote_id: string
          source_refs: Json | null
          sub_type: Database["public"]["Enums"]["quote_line_sub_type"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["quote_line_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          quote_id: string
          source_refs?: Json | null
          sub_type?: Database["public"]["Enums"]["quote_line_sub_type"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["quote_line_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          quote_id?: string
          source_refs?: Json | null
          sub_type?: Database["public"]["Enums"]["quote_line_sub_type"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "repairer_hourly_rate"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          automatic: boolean
          case_id: string
          changed_at: string
          changed_by: string | null
          created_at: string
          created_by: string | null
          from_status: Database["public"]["Enums"]["case_status"] | null
          id: string
          to_status: Database["public"]["Enums"]["case_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          automatic?: boolean
          case_id: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          from_status?: Database["public"]["Enums"]["case_status"] | null
          id?: string
          to_status: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          automatic?: boolean
          case_id?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          from_status?: Database["public"]["Enums"]["case_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tag: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      task: {
        Row: {
          assignee_user_id: string | null
          case_id: string | null
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          created_by: string | null
          done: boolean
          due_date: string | null
          id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignee_user_id?: string | null
          case_id?: string | null
          category: Database["public"]["Enums"]["task_category"]
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignee_user_id?: string | null
          case_id?: string | null
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "task_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle: {
        Row: {
          category: Database["public"]["Enums"]["vehicle_category"] | null
          co2: number | null
          colour: string | null
          created_at: string
          created_by: string | null
          engine_cc: number | null
          first_registration_date: string | null
          id: string
          leasing_account_id: string | null
          licence_plate: string
          make: string | null
          model: string | null
          model_year: number | null
          owner_account_id: string | null
          paint_type: string | null
          power_kw: number | null
          seats: number | null
          type_designation: string | null
          updated_at: string
          updated_by: string | null
          vin: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["vehicle_category"] | null
          co2?: number | null
          colour?: string | null
          created_at?: string
          created_by?: string | null
          engine_cc?: number | null
          first_registration_date?: string | null
          id?: string
          leasing_account_id?: string | null
          licence_plate: string
          make?: string | null
          model?: string | null
          model_year?: number | null
          owner_account_id?: string | null
          paint_type?: string | null
          power_kw?: number | null
          seats?: number | null
          type_designation?: string | null
          updated_at?: string
          updated_by?: string | null
          vin?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["vehicle_category"] | null
          co2?: number | null
          colour?: string | null
          created_at?: string
          created_by?: string | null
          engine_cc?: number | null
          first_registration_date?: string | null
          id?: string
          leasing_account_id?: string | null
          licence_plate?: string
          make?: string | null
          model?: string | null
          model_year?: number | null
          owner_account_id?: string | null
          paint_type?: string | null
          power_kw?: number | null
          seats?: number | null
          type_designation?: string | null
          updated_at?: string
          updated_by?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_leasing_account_id_fkey"
            columns: ["leasing_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      quote_line_history: {
        Row: {
          amount: number | null
          case_id: string | null
          category: Database["public"]["Enums"]["quote_line_category"] | null
          client_account_id: string | null
          created_at: string | null
          description: string | null
          make: string | null
          model: string | null
          model_year: number | null
          origin: Database["public"]["Enums"]["quote_origin"] | null
          quote_id: string | null
          quote_line_id: string | null
          quote_status: Database["public"]["Enums"]["quote_status"] | null
          repairer_account_id: string | null
          sub_type: Database["public"]["Enums"]["quote_line_sub_type"] | null
          vehicle_category:
            | Database["public"]["Enums"]["vehicle_category"]
            | null
          version: Database["public"]["Enums"]["quote_version"] | null
        }
        Relationships: [
          {
            foreignKeyName: "case_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_party_account_id_fkey"
            columns: ["repairer_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
        ]
      }
      repairer_hourly_rate: {
        Row: {
          case_id: string | null
          hourly_rate_assembly: number | null
          hourly_rate_paint: number | null
          origin: Database["public"]["Enums"]["quote_origin"] | null
          quote_id: string | null
          quoted_at: string | null
          repairer_account_id: string | null
          version: Database["public"]["Enums"]["quote_version"] | null
        }
        Relationships: [
          {
            foreignKeyName: "case_party_account_id_fkey"
            columns: ["repairer_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "quote_line_history"
            referencedColumns: ["case_id"]
          },
        ]
      }
    }
    Functions: {
      is_internal_user: { Args: never; Returns: boolean }
    }
    Enums: {
      account_type:
        | "client"
        | "broker"
        | "insurer"
        | "expert"
        | "repairer"
        | "leasing_company"
        | "supplier"
        | "third_party"
      actor_type: "user" | "system" | "agent"
      assessment_type:
        | "none"
        | "on_site"
        | "smart_expertise"
        | "approval_without_expert"
      case_status:
        | "client_assignment"
        | "intake_first_contact"
        | "followup_client"
        | "followup_broker_insurer"
        | "followup_repairer"
        | "followup_expert"
        | "followup_repairer_report_ok"
        | "followup_delay"
        | "invoicing_other"
        | "invoicing_ok"
        | "closed"
      communication_channel: "email" | "phone" | "other"
      communication_direction: "in" | "out"
      completeness_stage: "intake" | "quote" | "invoicing"
      document_category:
        | "claim_form"
        | "photo"
        | "estimate"
        | "expert_report"
        | "invoice"
        | "repair_order"
        | "purchase_order"
        | "generated"
        | "other"
      event_type:
        | "case.created"
        | "status.changed"
        | "email.received"
        | "quote.validated"
        | "message.sent"
      inbound_parse_status:
        | "new"
        | "linked"
        | "triage"
        | "converted"
        | "ignored"
      intake_draft_status: "draft" | "in_review" | "accepted" | "rejected"
      invoice_direction: "purchase" | "sales"
      outbound_message_status: "draft" | "approved" | "sent" | "failed"
      party_role:
        | "owner_fleet_owner"
        | "leasing_company"
        | "driver"
        | "insured_tenant"
        | "insurer"
        | "intermediary"
        | "third_party"
        | "expert"
        | "repairer"
      quote_line_category:
        | "labour"
        | "parts"
        | "paint_products"
        | "smart_repair"
        | "other_costs"
        | "fixed_price"
        | "deduction"
      quote_line_sub_type:
        | "assembly_disassembly"
        | "paintwork"
        | "panel_work"
        | "preparation"
        | "finishing"
        | "environmental_fee"
        | "anti_rust"
        | "small_parts"
        | "polishing"
        | "covid_flat_fee"
        | "cavity_protection"
        | "diagnostics"
        | "miscellaneous"
        | "previous_claim"
        | "wear_and_tear"
      quote_origin: "repairer" | "expert" | "manual" | "ai"
      quote_status:
        | "draft"
        | "pending_review"
        | "validated"
        | "rejected"
        | "sent"
      quote_version: "pre_calculation" | "post_calculation"
      repair_decision: "repair" | "no_repair" | "total_loss"
      task_category:
        | "my_tasks"
        | "repairer_dealer"
        | "fleet_insurer"
        | "supplier"
        | "broker"
      vehicle_category:
        | "electric"
        | "hybrid"
        | "diesel"
        | "petrol"
        | "light_van"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: [
        "client",
        "broker",
        "insurer",
        "expert",
        "repairer",
        "leasing_company",
        "supplier",
        "third_party",
      ],
      actor_type: ["user", "system", "agent"],
      assessment_type: [
        "none",
        "on_site",
        "smart_expertise",
        "approval_without_expert",
      ],
      case_status: [
        "client_assignment",
        "intake_first_contact",
        "followup_client",
        "followup_broker_insurer",
        "followup_repairer",
        "followup_expert",
        "followup_repairer_report_ok",
        "followup_delay",
        "invoicing_other",
        "invoicing_ok",
        "closed",
      ],
      communication_channel: ["email", "phone", "other"],
      communication_direction: ["in", "out"],
      completeness_stage: ["intake", "quote", "invoicing"],
      document_category: [
        "claim_form",
        "photo",
        "estimate",
        "expert_report",
        "invoice",
        "repair_order",
        "purchase_order",
        "generated",
        "other",
      ],
      event_type: [
        "case.created",
        "status.changed",
        "email.received",
        "quote.validated",
        "message.sent",
      ],
      inbound_parse_status: ["new", "linked", "triage", "converted", "ignored"],
      intake_draft_status: ["draft", "in_review", "accepted", "rejected"],
      invoice_direction: ["purchase", "sales"],
      outbound_message_status: ["draft", "approved", "sent", "failed"],
      party_role: [
        "owner_fleet_owner",
        "leasing_company",
        "driver",
        "insured_tenant",
        "insurer",
        "intermediary",
        "third_party",
        "expert",
        "repairer",
      ],
      quote_line_category: [
        "labour",
        "parts",
        "paint_products",
        "smart_repair",
        "other_costs",
        "fixed_price",
        "deduction",
      ],
      quote_line_sub_type: [
        "assembly_disassembly",
        "paintwork",
        "panel_work",
        "preparation",
        "finishing",
        "environmental_fee",
        "anti_rust",
        "small_parts",
        "polishing",
        "covid_flat_fee",
        "cavity_protection",
        "diagnostics",
        "miscellaneous",
        "previous_claim",
        "wear_and_tear",
      ],
      quote_origin: ["repairer", "expert", "manual", "ai"],
      quote_status: [
        "draft",
        "pending_review",
        "validated",
        "rejected",
        "sent",
      ],
      quote_version: ["pre_calculation", "post_calculation"],
      repair_decision: ["repair", "no_repair", "total_loss"],
      task_category: [
        "my_tasks",
        "repairer_dealer",
        "fleet_insurer",
        "supplier",
        "broker",
      ],
      vehicle_category: ["electric", "hybrid", "diesel", "petrol", "light_van"],
    },
  },
} as const
