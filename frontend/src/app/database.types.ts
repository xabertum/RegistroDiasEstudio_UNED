import type { Progreso } from './estudio-cloud.model';

export interface Database {
  public: {
    Tables: {
      study_progress: {
        Row: { user_id: string; revision: number; data: Progreso };
        Insert: { user_id: string; revision?: number; data?: Progreso };
        Update: { revision?: number; data?: Progreso };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
