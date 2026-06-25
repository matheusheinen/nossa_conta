import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function CriarGrupoScreen({ navigation }: any) {
  const { session } = useAuth();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'O nome do grupo é obrigatório');
      return;
    }
    try {
      setSalvando(true);
      // O trigger ao_criar_grupo já adiciona o criador como membro automaticamente
      const { error } = await supabase.from('grupos').insert({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        criado_por: session!.user.id,
      });
      if (error) throw error;
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome do grupo</Text>
      <TextInput style={styles.input} placeholder="Ex: Viagem à praia" value={nome} onChangeText={setNome} />

      <Text style={styles.label}>Descrição (opcional)</Text>
      <TextInput style={styles.input} placeholder="Ex: Galera do fim de semana" value={descricao} onChangeText={setDescricao} />

      <TouchableOpacity style={styles.botao} onPress={salvar} disabled={salvando}>
        <Text style={styles.botaoTexto}>{salvando ? 'Salvando...' : 'Criar grupo'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 12, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16 },
  botao: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 24 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});