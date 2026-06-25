import { supabase } from './supabase';
import { ResultadoBalanco } from '../types';

export async function calcularBalanco(grupoId: string): Promise<ResultadoBalanco> {
  const { data, error } = await supabase.functions.invoke('calcular-balanco', {
    body: { grupoId },
  });
  if (error) throw new Error(`Erro ao calcular balanço: ${error.message}`);
  return data as ResultadoBalanco;
}