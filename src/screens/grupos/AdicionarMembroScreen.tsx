import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Keyboard,
} from 'react-native';
import { supabase } from '../../services/supabase';

export function AdicionarMembroScreen({ route, navigation }: any) {
  const { grupoId } = route.params;
  const [email, setEmail] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [usuarioEncontrado, setUsuarioEncontrado] = useState<{
    id: string;
    nome_completo: string;
    email: string;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const buscarUsuario = async () => {
    Keyboard.dismiss();
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      setErro('Digite um email para buscar');
      return;
    }

    try {
      setBuscando(true);
      setErro(null);
      setUsuarioEncontrado(null);

      // Busca o usuário pelo email usando uma função RPC (bypassa o RLS)
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nome_completo, email')
        .eq('email', emailTrimmed)
        .maybeSingle();

      if (!usuario) {
        setErro('Nenhum usuário encontrado com este email. Verifique se a pessoa já possui conta no app.');
        return;
      }

      setUsuarioEncontrado(usuario);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const adicionarMembro = async () => {
    if (!usuarioEncontrado) return;

    try {
      setSalvando(true);
      const { error } = await supabase.from('membros_grupo').insert({
        grupo_id: grupoId,
        usuario_id: usuarioEncontrado.id,
      });
      if (error) throw error;

      Alert.alert('Sucesso', `${usuarioEncontrado.nome_completo} foi adicionado(a) ao grupo!`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instrucao}>
        Digite o email do usuário que deseja adicionar ao grupo. A pessoa precisa ter uma conta no NossaConta.
      </Text>

      <View style={styles.buscaRow}>
        <TextInput
          style={styles.input}
          placeholder="Email do membro"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(t) => { setEmail(t); setErro(null); setUsuarioEncontrado(null); }}
        />
        <TouchableOpacity style={styles.botaoBuscar} onPress={buscarUsuario} disabled={buscando}>
          {buscando ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.botaoBuscarTexto}>Buscar</Text>
          )}
        </TouchableOpacity>
      </View>

      {erro && (
        <Text style={styles.erroTexto}>⚠️ {erro}</Text>
      )}

      {usuarioEncontrado && (
        <View style={styles.resultadoCard}>
          <Text style={styles.resultadoNome}>{usuarioEncontrado.nome_completo}</Text>
          <Text style={styles.resultadoEmail}>{usuarioEncontrado.email}</Text>

          <TouchableOpacity
            style={[styles.botaoAdicionar, salvando && { opacity: 0.6 }]} 
            onPress={adicionarMembro}
            disabled={salvando}
          >
            <Text style={styles.botaoAdicionarTexto}>
              {salvando ? 'Adicionando...' : 'Adicionar ao grupo'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  instrucao: { color: '#666', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  buscaRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, fontSize: 16,
  },
  botaoBuscar: {
    backgroundColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  botaoBuscarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  erroTexto: {
    color: '#C62828', fontSize: 14, marginTop: 12, textAlign: 'center',
  },
  resultadoCard: {
    backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, marginTop: 20,
    borderLeftWidth: 4, borderLeftColor: '#2E7D32', alignItems: 'center',
  },
  resultadoNome: { fontSize: 18, fontWeight: '700', color: '#222' },
  resultadoEmail: { color: '#666', marginTop: 4 },
  botaoAdicionar: {
    backgroundColor: '#2E7D32', padding: 14, borderRadius: 10,
    alignItems: 'center', marginTop: 16, width: '100%',
  },
  botaoAdicionarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

interface Usuario {
  id: number;
  nome_completo: string;
}
