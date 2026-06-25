import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { Grupo } from '../../types';

export function GruposListScreen({ navigation }: any) {
  const [grupos, setGrupos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'abertos' | 'fechados'>('abertos');

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('grupos')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) Alert.alert('Erro', error.message);
    else setGrupos(data ?? []);
    setCarregando(false);
  };

  // Recarrega toda vez que a tela ganha foco (ex.: ao voltar de "Criar Grupo")
  useFocusEffect(useCallback(() => { carregar(); }, []));

  const gruposFiltrados = grupos.filter(g => {
    const status = g.status || 'aberto';
    if (statusFiltro === 'todos') return true;
    if (statusFiltro === 'abertos') return status === 'aberto';
    if (statusFiltro === 'fechados') return status === 'fechado';
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.filtrosContainer}>
        <TouchableOpacity style={[styles.btnFiltro, statusFiltro === 'abertos' && styles.btnFiltroAtivo]} onPress={() => setStatusFiltro('abertos')}>
          <Text style={[styles.btnFiltroTexto, statusFiltro === 'abertos' && styles.btnFiltroTextoAtivo]}>Abertos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnFiltro, statusFiltro === 'fechados' && styles.btnFiltroAtivo]} onPress={() => setStatusFiltro('fechados')}>
          <Text style={[styles.btnFiltroTexto, statusFiltro === 'fechados' && styles.btnFiltroTextoAtivo]}>Fechados</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnFiltro, statusFiltro === 'todos' && styles.btnFiltroAtivo]} onPress={() => setStatusFiltro('todos')}>
          <Text style={[styles.btnFiltroTexto, statusFiltro === 'todos' && styles.btnFiltroTextoAtivo]}>Todos</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={gruposFiltrados}
        keyExtractor={(g) => g.id}
        refreshing={carregando}
        onRefresh={carregar}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum grupo encontrado com este filtro.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, (item.status === 'fechado') && styles.cardFechado]}
            onPress={() => navigation.navigate('GrupoDetalhe', { grupoId: item.id, nome: item.nome, criadoPor: item.criado_por })}
          >
            <Text style={styles.nome}>{item.nome} {(item.status === 'fechado') ? '(Fechado)' : ''}</Text>
            {item.descricao ? <Text style={styles.desc}>{item.descricao}</Text> : null}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CriarGrupo')}>
        <Text style={styles.fabTexto}>+ Novo grupo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  filtrosContainer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btnFiltro: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E0E0E0' },
  btnFiltroAtivo: { backgroundColor: '#2E7D32' },
  btnFiltroTexto: { fontSize: 13, color: '#555', fontWeight: '600' },
  btnFiltroTextoAtivo: { color: '#fff' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#2E7D32', elevation: 1 },
  cardFechado: { borderLeftColor: '#C62828', opacity: 0.8 },
  nome: { fontSize: 16, fontWeight: '700', color: '#222' },
  desc: { color: '#666', marginTop: 4 },
  vazio: { textAlign: 'center', color: '#999', marginTop: 40 },
  fab: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 12, alignItems: 'center' },
  fabTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});