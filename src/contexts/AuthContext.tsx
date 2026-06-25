import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthContextData {
  session: Session | null;
  loading: boolean;
  cadastrar: (email: string, senha: string, nome: string, telefone: string) => Promise<{ confirmacaoPendente: boolean }>;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Recupera sessão salva
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Escuta mudanças de login/logout
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const cadastrar = async (email: string, senha: string, nome: string, telefone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome_completo: nome, telefone } },
    });
    if (error) throw error;
    // Se não retornou sessão, o Supabase está aguardando confirmação de email
    return { confirmacaoPendente: !data.session };
  };

  const entrar = async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
  };

  const sair = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, loading, cadastrar, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);