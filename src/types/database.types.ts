export interface Database {
  public: {
    Tables: {
      clientes: {
        Row: {
          id: string;
          tipo: 'particular' | 'empresa';
          dni_nif: string | null;
          nombre: string;
          apellidos: string | null;
          email: string | null;
          telefono: string | null;
          direccion: string | null;
          ciudad: string | null;
          codigo_postal: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tipo: 'particular' | 'empresa';
          nif?: string | null;
          nombre: string;
          apellidos?: string | null;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          ciudad?: string | null;
          codigo_postal?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tipo?: 'particular' | 'empresa';
          nif?: string | null;
          nombre?: string;
          apellidos?: string | null;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          ciudad?: string | null;
          codigo_postal?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'admin' | 'abogado' | 'administrativo';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'admin' | 'abogado' | 'administrativo';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: 'admin' | 'abogado' | 'administrativo';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
