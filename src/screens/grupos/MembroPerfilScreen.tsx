import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

export function MembroPerfilScreen({ route, navigation }: any) {
  const { membro, grupoId, isAdmin, isCriador } = route.params;

  const abrirWhatsApp = () => {
    if (!membro.telefone) {
      Alert.alert('Erro', 'Este usuário não possui telefone cadastrado.');
      return;
    }
    const telNumerico = membro.telefone.replace(/\D/g, '');
    const url = `https://wa.me/55${telNumerico}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'WhatsApp não está instalado ou link inválido.');
      }
    });
  };

  const [isRemoving, setIsRemoving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ tipo: 'erro' | 'sucesso', texto: string } | null>(null);
  const [modalRemocaoVisivel, setModalRemocaoVisivel] = React.useState(false);

  const executarRemocao = async () => {
    setIsRemoving(true);
    setFeedback(null);

    // Verifica se o membro tem despesas
    const { data: temDespesas, error: errRpc } = await supabase.rpc('verificar_membro_tem_despesas', {
      p_grupo_id: grupoId,
      p_usuario_id: membro.id
    });

    if (errRpc) {
      setIsRemoving(false);
      setFeedback({ tipo: 'erro', texto: `Erro: ${errRpc.message}` });
      return;
    }

    if (temDespesas) {
      setIsRemoving(false);
      setFeedback({
        tipo: 'erro',
        texto: 'Exclusão Bloqueada: Este membro está envolvido em despesas (como pagador ou devedor) neste grupo. Você precisa remover ele das despesas ou excluí-las antes de removê-lo do grupo.'
      });
      return;
    }

    const { data, error } = await supabase
      .from('membros_grupo')
      .delete()
      .eq('grupo_id', grupoId)
      .eq('usuario_id', membro.id)
      .select();
    
    setIsRemoving(false);
    setModalRemocaoVisivel(false);
    if (error) {
      setFeedback({ tipo: 'erro', texto: `Erro ao remover: ${error.message}` });
    } else if (data && data.length === 0) {
      setFeedback({ tipo: 'erro', texto: 'Acesso negado: Você não tem permissão para remover este membro ou ele já foi removido.' });
    } else {
      setFeedback({ tipo: 'sucesso', texto: 'Membro removido do grupo.' });
      setTimeout(() => navigation.goBack(), 1500);
    }
  };

  const removerMembro = () => {
    setFeedback(null);
    setModalRemocaoVisivel(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={60} color="#2E7D32" />
        </View>
        <Text style={styles.nome}>
          {membro.nome_completo} {isCriador && <Text style={styles.adminTag}>(Admin)</Text>}
        </Text>
        <Text style={styles.telefone}>
          {membro.telefone ? membro.telefone : 'Telefone não informado'}
        </Text>

        <TouchableOpacity 
          style={[styles.botaoWhatsapp, !membro.telefone && styles.botaoDesabilitado]} 
          onPress={abrirWhatsApp}
          disabled={!membro.telefone}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.botaoWhatsappTexto}>Chamar no WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {isAdmin && !isCriador && (
        <TouchableOpacity style={styles.btnRemover} onPress={removerMembro}>
          <Ionicons name="trash-outline" size={20} color="#C62828" />
          <Text style={styles.btnRemoverTexto}>Remover do Grupo</Text>
        </TouchableOpacity>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO */}
      <Modal visible={modalRemocaoVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Remover Membro</Text>
            <Text style={styles.modalDesc}>
              Tem certeza que deseja remover {membro.nome_completo} do grupo?
            </Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.modalBtnCancelar} onPress={() => setModalRemocaoVisivel(false)} disabled={isRemoving}>
                <Text style={styles.modalBtnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirmar} onPress={executarRemocao} disabled={isRemoving}>
                <Text style={styles.modalBtnConfirmarTexto}>{isRemoving ? 'Removendo...' : 'Remover'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {feedback && (
        <View style={[styles.feedbackBox, feedback.tipo === 'erro' ? styles.feedbackErro : styles.feedbackSucesso]}>
          <Ionicons 
            name={feedback.tipo === 'erro' ? "alert-circle" : "checkmark-circle"} 
            size={24} 
            color={feedback.tipo === 'erro' ? "#C62828" : "#2E7D32"} 
          />
          <Text style={[styles.feedbackTexto, feedback.tipo === 'erro' ? styles.feedbackTextoErro : styles.feedbackTextoSucesso]}>
            {feedback.texto}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nome: { fontSize: 22, fontWeight: '700', color: '#333', textAlign: 'center' },
  adminTag: { color: '#2E7D32', fontSize: 16, fontWeight: '600' },
  telefone: { fontSize: 16, color: '#666', marginTop: 8, marginBottom: 24 },
  botaoWhatsapp: {
    flexDirection: 'row',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoDesabilitado: { backgroundColor: '#ccc' },
  botaoWhatsappTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnRemover: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#C62828',
    gap: 8,
  },
  btnRemoverTexto: { color: '#C62828', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', padding: 24, borderRadius: 12, elevation: 5 },
  modalTitulo: { fontSize: 20, fontWeight: '700', color: '#C62828', marginBottom: 12 },
  modalDesc: { fontSize: 16, color: '#444', lineHeight: 22, marginBottom: 24 },
  modalBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnCancelar: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f5f5f5' },
  modalBtnCancelarTexto: { color: '#666', fontWeight: '700', fontSize: 14 },
  modalBtnConfirmar: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#C62828' },
  modalBtnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderLeftWidth: 4,
  },
  feedbackErro: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: '#C62828',
  },
  feedbackSucesso: {
    backgroundColor: '#E8F5E9',
    borderLeftColor: '#2E7D32',
  },
  feedbackTexto: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  feedbackTextoErro: {
    color: '#C62828',
  },
  feedbackTextoSucesso: {
    color: '#2E7D32',
  }
});
