export interface Database {
  public: {
    Tables: {
      user_credits: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          display_name: string | null;
          credits: number;
          total_credits_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email?: string | null;
          display_name?: string | null;
          credits?: number;
          total_credits_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string | null;
          display_name?: string | null;
          credits?: number;
          total_credits_used?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: "debit" | "credit" | "welcome_bonus" | "refund";
          description: string | null;
          task_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          type: "debit" | "credit" | "welcome_bonus" | "refund";
          description?: string | null;
          task_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          type?: "debit" | "credit" | "welcome_bonus" | "refund";
          description?: string | null;
          task_id?: number | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
