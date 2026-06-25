import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Linking, Platform, Modal
} from 'react-native';
import Checkbox from 'expo-checkbox';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Membro } from '../../types';

export function EditarDespesaScreen({ route, navigation }: any) {
  const { grupoId, despesaId, statusGrupo } = route.params;
  const { session } = useAuth();

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [pagoPor, setPagoPor] = useState<string | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [comprovanteUri, setComprovanteUri] = useState<string | null>(null);
  const [comprovanteAtualUrl, setComprovanteAtualUrl] = useState<string | null>(null);
  const [modalExclusaoVisivel, setModalExclusaoVisivel] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  const mostrarErro = (texto: string) => {
    setFeedback({ tipo: 'erro', texto });
    setTimeout(() => setFeedback(null), 5000);
  };

  useEffect(() => { carregarDados(); }, [grupoId, despesaId]);

  const carregarDados = async () => {
    try {
      // Carrega membros
      const { data: dataMembros, error: errMembros } = await supabase
        .from('membros_grupo')
        .select('usuario_id, usuarios(id, nome_completo)')
        .eq('grupo_id', grupoId);
      if (errMembros) throw errMembros;

      const lista: Membro[] = (dataMembros ?? []).map((mg: any) => ({
        id: mg.usuario_id,
        nome_completo: mg.usuarios.nome_completo,
      }));
      setMembros(lista);

      // Carrega a despesa
      const { data: despesa, error: errDesp } = await supabase
        .from('despesas')
        .select('*')
        .eq('id', despesaId)
        .single();
      if (errDesp) throw errDesp;

      setDescricao(despesa.descricao);
      setValor(despesa.valor.toString());
      setPagoPor(despesa.pago_por_usuario_id);
      if (despesa.url_comprovante) {
        setComprovanteAtualUrl(despesa.url_comprovante);
      }

      // Carrega as divisões
      const { data: divisoes, error: errDiv } = await supabase
        .from('divisoes_despesa')
        .select('usuario_id')
        .eq('despesa_id', despesaId);
      if (errDiv) throw errDiv;

      const setDivisoes = new Set((divisoes ?? []).map((d: any) => d.usuario_id));
      setSelecionados(setDivisoes);

    } catch (e: any) {
      mostrarErro(e.message);
      setTimeout(() => navigation.goBack(), 2000);
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
      let urlComprovantePublica = comprovanteAtualUrl;

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

      // 1) Atualiza a despesa
      const { error: errDespesa } = await supabase
        .from('despesas')
        .update({
          pago_por_usuario_id: pagoPor,
          descricao: descricao.trim(),
          valor: valorNum,
          url_comprovante: urlComprovantePublica,
        })
        .eq('id', despesaId);
      if (errDespesa) throw errDespesa;

      // 2) Deleta as divisões antigas e cria as novas
      const { error: errDel } = await supabase.from('divisoes_despesa').delete().eq('despesa_id', despesaId);
      if (errDel) throw errDel;

      const valorPorPessoa = Math.round((valorNum / selecionados.size) * 100) / 100;
      const novasDivisoes = Array.from(selecionados).map((usuarioId) => ({
        despesa_id: despesaId,
        usuario_id: usuarioId,
        valor_devido: valorPorPessoa,
      }));

      const { error: errDiv } = await supabase.from('divisoes_despesa').insert(novasDivisoes);
      if (errDiv) throw errDiv;

      setFeedback({ tipo: 'sucesso', texto: 'Despesa atualizada com sucesso!' });
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

  const executarExclusao = async () => {
    try {
      setExcluindo(true);
      const { error } = await supabase.from('despesas').delete().eq('id', despesaId);
      if (error) throw error;
      setModalExclusaoVisivel(false);
      navigation.goBack();
    } catch (e: any) {
      mostrarErro(`Erro ao excluir: ${e.message}`);
      setExcluindo(false);
      setModalExclusaoVisivel(false);
    }
  };

  const excluirDespesa = () => {
    setModalExclusaoVisivel(true);
  };

  if (carregando) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;
  }

  const valorNum = parseFloat(valor.replace(',', '.'));
  const mostrarResumo = !isNaN(valorNum) && valorNum > 0 && selecionados.size > 0;

  return (
    <ScrollView style={styles.container}>
      {statusGrupo === 'fechado' && (
        <View style={styles.avisoFechado}>
          <Text style={styles.avisoFechadoTexto}>
            🔒 Esta conta está fechada. A despesa não pode ser alterada ou excluída.
          </Text>
        </View>
      )}

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
      <TextInput style={styles.input} placeholder="Ex: Pizza, Uber..." value={descricao} onChangeText={setDescricao} editable={statusGrupo !== 'fechado'} />

      <Text style={styles.label}>Valor (R$)</Text>
      <TextInput style={styles.input} placeholder="0,00" keyboardType="decimal-pad" value={valor} onChangeText={setValor} editable={statusGrupo !== 'fechado'} />

      <Text style={styles.label}>Quem pagou?</Text>
      <View style={styles.botoesPagou}>
        {membros.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, pagoPor === m.id && styles.chipAtivo]}
            onPress={() => statusGrupo !== 'fechado' && setPagoPor(m.id)}
            disabled={statusGrupo === 'fechado'}
          >
            <Text style={[styles.chipTexto, pagoPor === m.id && styles.chipTextoAtivo]}>{m.nome_completo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Dividir entre:</Text>
      <View style={styles.caixaMembros}>
        {membros.map((m) => (
          <TouchableOpacity key={m.id} style={styles.linhaMembro} onPress={() => statusGrupo !== 'fechado' && alternar(m.id)} disabled={statusGrupo === 'fechado'}>
            <Checkbox value={selecionados.has(m.id)} onValueChange={() => statusGrupo !== 'fechado' && alternar(m.id)} color="#2E7D32" disabled={statusGrupo === 'fechado'} />
            <Text style={styles.membroNome}>{m.nome_completo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Comprovante (Opcional)</Text>
      
      {comprovanteAtualUrl && !comprovanteUri && (
        <View style={styles.previewContainer}>
          <TouchableOpacity onPress={() => Linking.openURL(comprovanteAtualUrl)} style={{ flex: 1 }}>
            <Text style={styles.linkTexto}>Ver comprovante atual</Text>
          </TouchableOpacity>
          {statusGrupo !== 'fechado' && (
            <TouchableOpacity onPress={() => setComprovanteAtualUrl(null)}>
              <Ionicons name="trash" size={24} color="#C62828" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {statusGrupo !== 'fechado' && (
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
      )}
      
      {comprovanteUri && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTexto}>Novo arquivo selecionado</Text>
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

      {statusGrupo !== 'fechado' && (
        <>
          <TouchableOpacity style={[styles.botao, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando || excluindo}>
            <Text style={styles.botaoTexto}>{salvando ? 'Salvando...' : 'Salvar alterações'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.botaoExcluir, excluindo && { opacity: 0.6 }]} onPress={excluirDespesa} disabled={salvando || excluindo}>
            <Text style={styles.botaoExcluirTexto}>{excluindo ? 'Excluindo...' : 'Excluir despesa'}</Text>
          </TouchableOpacity>
        </>
      )}
      
      <View style={{height: 40}} />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Modal visible={modalExclusaoVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Excluir Despesa</Text>
            <Text style={styles.modalDesc}>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.modalBtnCancelar} onPress={() => setModalExclusaoVisivel(false)} disabled={excluindo}>
                <Text style={styles.modalBtnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirmar} onPress={executarExclusao} disabled={excluindo}>
                <Text style={styles.modalBtnConfirmarTexto}>{excluindo ? 'Excluindo...' : 'Excluir'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  botao: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 24, marginBottom: 12 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  botaoExcluir: { backgroundColor: '#C62828', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 40 },
  botaoExcluirTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  botaoAnexo: { flex: 1, flexDirection: 'row', backgroundColor: '#E8F5E9', padding: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2E7D32', gap: 6, marginTop: 8 },
  botaoAnexoTexto: { color: '#2E7D32', fontWeight: '700', fontSize: 13 },
  previewContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  previewTexto: { color: '#2E7D32', fontWeight: '600' },
  linkTexto: { color: '#1976D2', fontWeight: '600', textDecorationLine: 'underline' },
  avisoFechado: { backgroundColor: '#FFEBEE', padding: 12, borderRadius: 8, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#C62828' },
  avisoFechadoTexto: { color: '#C62828', fontWeight: '700', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', padding: 24, borderRadius: 12, elevation: 5 },
  modalTitulo: { fontSize: 20, fontWeight: '700', color: '#C62828', marginBottom: 12 },
  modalDesc: { fontSize: 16, color: '#444', lineHeight: 22, marginBottom: 24 },
  modalBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnCancelar: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f5f5f5' },
  modalBtnCancelarTexto: { color: '#666', fontWeight: '700', fontSize: 14 },
  modalBtnConfirmar: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#C62828' },
  modalBtnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  feedbackBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  feedbackSucesso: { backgroundColor: '#E8F5E9', borderLeftWidth: 4, borderLeftColor: '#2E7D32' },
  feedbackErro: { backgroundColor: '#FFEBEE', borderLeftWidth: 4, borderLeftColor: '#C62828' },
  feedbackTexto: { fontSize: 14, fontWeight: '600', flex: 1 },
  feedbackTextoSucesso: { color: '#2E7D32' },
  feedbackTextoErro: { color: '#C62828' }
});