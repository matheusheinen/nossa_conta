import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { calcularBalanco } from '../services/balanco.service';
import { Acerto } from '../types';

export function ResumoBalanco({ grupoId }: { grupoId: string }) {
  const [acertos, setAcertos] = useState<Acerto[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      // Nomes dos membros (para exibir em vez de IDs)
      const { data: membros } = await supabase
        .from('membros_grupo')
        .select('usuario_id, usuarios(nome_completo)')
        .eq('grupo_id', grupoId);
      const mapa: Record<string, string> = {};
      (membros ?? []).forEach((m: any) => { mapa[m.usuario_id] = m.usuarios.nome_completo; });
      setNomes(mapa);

      const resultado = await calcularBalanco(grupoId);
      setAcertos(resultado.acertos);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [grupoId]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  if (carregando) return <ActivityIndicator color="#2E7D32" style={{ marginVertical: 16 }} />;
  if (erro) return <Text style={styles.erro}>⚠️ {erro}</Text>;
  if (acertos.length === 0) return <Text style={styles.ok}>✅ Tudo equilibrado!</Text>;

  return (
    <View style={styles.box}>
      <Text style={styles.titulo}>Quem paga quem</Text>
      {acertos.map((a, i) => (
        <View key={i} style={styles.linha}>
          <Text style={styles.texto}>
            <Text style={styles.bold}>{nomes[a.de] ?? a.de.slice(0, 6)}</Text>
            {' paga '}
            <Text style={styles.valor}>R$ {a.valor.toFixed(2)}</Text>
            {' para '}
            <Text style={styles.bold}>{nomes[a.para] ?? a.para.slice(0, 6)}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginVertical: 8 },
  titulo: { fontWeight: '700', color: '#333', marginBottom: 10 },
  linha: { backgroundColor: '#F1F8E9', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#2E7D32' },
  texto: { color: '#555', lineHeight: 20 },
  bold: { fontWeight: '700', color: '#222' },
  valor: { fontWeight: '700', color: '#2E7D32' },
  rodape: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 4 },
  ok: { textAlign: 'center', color: '#2E7D32', fontWeight: '600', marginVertical: 16 },
  erro: { color: '#C62828', marginVertical: 16 },
});