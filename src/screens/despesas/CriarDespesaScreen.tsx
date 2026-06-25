import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator
} from 'react-native';
import Checkbox from 'expo-checkbox';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Membro } from '../../types';

export function CriarDespesaScreen({ route, navigation }: any) {
  const { grupoId } = route.params;
  const { session } = useAuth();

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [pagoPor, setPagoPor] = useState<string | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [comprovanteUri, setComprovanteUri] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  const mostrarErro = (texto: string) => {
    setFeedback({ tipo: 'erro', texto });
    setTimeout(() => setFeedback(null), 5000);
  };

  useEffect(() => { carregarMembros(); }, [grupoId]);

  const carregarMembros = async () => {
    try {
      const { data, error } = await supabase
        .from('membros_grupo')
        .select('usuario_id, usuarios(id, nome_completo)')
        .eq('grupo_id', grupoId);
      if (error) throw error;

      const lista: Membro[] = (data ?? []).map((mg: any) => ({
        id: mg.usuario_id,
        nome_completo: mg.usuarios.nome_completo,
      }));
      setMembros(lista);

      const meuId = session!.user.id;
      setPagoPor(meuId);
      setSelecionados(new Set([meuId]));
    } catch (e: any) {
      mostrarErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  const alternar = (id: string) => {
    const novo = new Set(selecionados);
    novo.has(id) ? novo.delete(id) : novo.add(id);
    setSelecionados(novo);
  };

  const tirarFoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!res.canceled) setComprovanteUri(res.assets[0].uri);
  };

  const escolherGaleria = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
    if (!res.canceled) setComprovanteUri(res.assets[0].uri);
  };

  const escolherPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (!res.canceled && res.assets) setComprovanteUri(res.assets[0].uri);
  };

  const salvar = async () => {
    setFeedback(null);
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim()) return mostrarErro('A descrição é obrigatória.');
    if (isNaN(valorNum) || valorNum <= 0) return mostrarErro('O valor deve ser maior que zero.');
    if (!pagoPor) return mostrarErro('Selecione quem pagou a despesa.');
    if (selecionados.size === 0) return mostrarErro('Selecione pelo menos um participante (divisão).');

    try {
      setSalvando(true);
      let urlComprovantePublica = null;

      if (comprovanteUri) {
        try {
          const res = await fetch(comprovanteUri);
          const blob = await res.blob();
          const ext = comprovanteUri.split('.').pop() || 'jpg';
          const path = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('comprovantes')
            .upload(path, blob);
            
          if (uploadError) throw uploadError;
          
          const { data: publicUrl } = supabase.storage.from('comprovantes').getPublicUrl(path);
          urlComprovantePublica = publicUrl.publicUrl;
        } catch (err: any) {
          mostrarErro(`Erro no anexo: ${err.message}`);
          setSalvando(false);
          return;
        }
      }

      const { data: despesa, error: errDespesa } = await supabase
        .from('despesas')
        .insert({
          grupo_id: grupoId,
          pago_por_usuario_id: pagoPor,
          descricao: descricao.trim(),
          valor: valorNum,
          url_comprovante: urlComprovantePublica,
        })
        .select()
        .single();
      if (errDespesa) throw errDespesa;

      const valorPorPessoa = Math.round((valorNum / selecionados.size) * 100) / 100;
      const divisoes = Array.from(selecionados).map((usuarioId) => ({
        despesa_id: despesa.id,
        usuario_id: usuarioId,
        valor_devido: valorPorPessoa,
      }));

      const { error: errDiv } = await supabase.from('divisoes_despesa').insert(divisoes);
      if (errDiv) throw errDiv;

      setFeedback({ tipo: 'sucesso', texto: 'Despesa registrada!' });
      setTimeout(() => {
        setFeedback(null);
        navigation.goBack();
      }, 1500);
    } catch (e: any) {
      mostrarErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;
  }

  const valorNum = parseFloat(valor.replace(',', '.'));
  const mostrarResumo = !isNaN(valorNum) && valorNum > 0 && selecionados.size > 0;

  return (
    <ScrollView style={styles.container}>
      {feedback && (
        <View style={[styles.feedbackBox, feedback.tipo === 'erro' ? styles.feedbackErro : styles.feedbackSucesso]}>
          <Ionicons 
            name={feedback.tipo === 'erro' ? "alert-circle" : "checkmark-circle"} 
            size={20} 
            color={feedback.tipo === 'erro' ? "#C62828" : "#2E7D32"} 
          />
          <Text style={[styles.feedbackTexto, feedback.tipo === 'erro' ? styles.feedbackTextoErro : styles.feedbackTextoSucesso]}>
            {feedback.texto}
          </Text>
        </View>
      )}

      <Text style={styles.label}>Descrição da Despesa *</Text>
      <TextInput style={styles.input} placeholder="Ex: Pizza, Uber..." value={descricao} onChangeText={setDescricao} />

      <Text style={styles.label}>Valor (R$)</Text>
      <TextInput style={styles.input} placeholder="0,00" keyboardType="decimal-pad" value={valor} onChangeText={setValor} />

      <Text style={styles.label}>Quem pagou?</Text>
      <View style={styles.botoesPagou}>
        {membros.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, pagoPor === m.id && styles.chipAtivo]}
            onPress={() => setPagoPor(m.id)}
          >
            <Text style={[styles.chipTexto, pagoPor === m.id && styles.chipTextoAtivo]}>{m.nome_completo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Dividir entre:</Text>
      <View style={styles.caixaMembros}>
        {membros.map((m) => (
          <TouchableOpacity key={m.id} style={styles.linhaMembro} onPress={() => alternar(m.id)}>
            <Checkbox value={selecionados.has(m.id)} onValueChange={() => alternar(m.id)} color="#2E7D32" />
            <Text style={styles.membroNome}>{m.nome_completo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Comprovante (Opcional)</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <TouchableOpacity style={styles.botaoAnexo} onPress={tirarFoto}>
          <Ionicons name="camera" size={20} color="#2E7D32" />
          <Text style={styles.botaoAnexoTexto}>Câmera</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.botaoAnexo} onPress={escolherGaleria}>
          <Ionicons name="image" size={20} color="#2E7D32" />
          <Text style={styles.botaoAnexoTexto}>Galeria</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botaoAnexo} onPress={escolherPdf}>
          <Ionicons name="document" size={20} color="#2E7D32" />
          <Text style={styles.botaoAnexoTexto}>PDF</Text>
        </TouchableOpacity>
      </View>
      
      {comprovanteUri && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTexto}>Arquivo selecionado</Text>
          <TouchableOpacity onPress={() => setComprovanteUri(null)}>
            <Ionicons name="close-circle" size={24} color="#C62828" />
          </TouchableOpacity>
        </View>
      )}

      {mostrarResumo && (
        <View style={styles.resumo}>
          <Text style={styles.resumoTitulo}>Resumo</Text>
          <Text style={styles.resumoTexto}>Total: R$ {valorNum.toFixed(2)}</Text>
          <Text style={styles.resumoTexto}>Dividido entre {selecionados.size} pessoa(s)</Text>
          <Text style={styles.resumoValor}>R$ {(valorNum / selecionados.size).toFixed(2)} por pessoa</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.botao, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
        <Text style={styles.botaoTexto}>{salvando ? 'Salvando...' : 'Salvar despesa'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  feedbackBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  feedbackSucesso: { backgroundColor: '#E8F5E9', borderLeftWidth: 4, borderLeftColor: '#2E7D32' },
  feedbackErro: { backgroundColor: '#FFEBEE', borderLeftWidth: 4, borderLeftColor: '#C62828' },
  feedbackTexto: { fontSize: 14, fontWeight: '600', flex: 1 },
  feedbackTextoSucesso: { color: '#2E7D32' },
  feedbackTextoErro: { color: '#C62828' },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 14, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16 },
  botoesPagou: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  chipAtivo: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  chipTexto: { color: '#555', fontWeight: '500' },
  chipTextoAtivo: { color: '#fff' },
  caixaMembros: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 8 },
  linhaMembro: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  membroNome: { fontSize: 15, color: '#333' },
  resumo: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, marginTop: 18, borderLeftWidth: 4, borderLeftColor: '#2E7D32' },
  resumoTitulo: { fontWeight: '700', color: '#2E7D32', marginBottom: 6 },
  resumoTexto: { color: '#555', marginBottom: 2 },
  resumoValor: { fontWeight: '800', color: '#2E7D32', fontSize: 16, marginTop: 6 },
  botao: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  botaoAnexo: { flex: 1, flexDirection: 'row', backgroundColor: '#E8F5E9', padding: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2E7D32', gap: 6 },
  botaoAnexoTexto: { color: '#2E7D32', fontWeight: '700', fontSize: 13 },
  previewContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  previewTexto: { color: '#555', fontStyle: 'italic', flex: 1 }
});