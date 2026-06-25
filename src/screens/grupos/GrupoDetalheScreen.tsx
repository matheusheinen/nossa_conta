import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { Despesa, Membro } from '../../types';
import { ResumoBalanco } from '../../components/ResumoBalanco';
import { useAuth } from '../../contexts/AuthContext';

export function GrupoDetalheScreen({ route, navigation }: any) {
  const { grupoId, nome, criadoPor } = route.params;
  const { session } = useAuth();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [filtroData, setFiltroData] = useState<'todas' | '30' | '7'>('todas');
  const [statusGrupo, setStatusGrupo] = useState<'aberto' | 'fechado'>('aberto');
  const [isFechando, setIsFechando] = useState(false);
  const [acertos, setAcertos] = useState<any[]>([]);
  const [modalFechamentoVisivel, setModalFechamentoVisivel] = useState(false);
  const [modalExclusaoGrupoVisivel, setModalExclusaoGrupoVisivel] = useState(false);
  const [isExcluindoGrupo, setIsExcluindoGrupo] = useState(false);
  const [modalAcertoVisivel, setModalAcertoVisivel] = useState(false);
  const [acertoSelecionado, setAcertoSelecionado] = useState<any>(null);
  const [isConfirmandoAcerto, setIsConfirmandoAcerto] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  const isAdmin = session?.user?.id === criadoPor;

  const carregar = async () => {
    // Carrega o grupo para ver o status
    let currentStatus = 'aberto';
    const { data: dataGrupo } = await supabase
      .from('grupos')
      .select('status')
      .eq('id', grupoId)
      .single();
    if (dataGrupo) {
      currentStatus = dataGrupo.status;
      setStatusGrupo(dataGrupo.status);
    }

    if (currentStatus === 'fechado') {
      const { data: dataAcertos } = await supabase
        .from('acertos')
        .select(`
          id, valor, acertado_em,
          credor:usuarios!credor_usuario_id(nome_completo),
          devedor:usuarios!devedor_usuario_id(nome_completo),
          credor_usuario_id
        `)
        .eq('grupo_id', grupoId);
      setAcertos(dataAcertos ?? []);
    }

    // Carrega despesas
    let query = supabase
      .from('despesas')
      .select('*')
      .eq('grupo_id', grupoId)
      .order('criado_em', { ascending: false });

    if (filtroData === '30') {
      const data = new Date();
      data.setDate(data.getDate() - 30);
      query = query.gte('criado_em', data.toISOString());
    } else if (filtroData === '7') {
      const data = new Date();
      data.setDate(data.getDate() - 7);
      query = query.gte('criado_em', data.toISOString());
    }

    const { data: dataDespesas } = await query;
    setDespesas(dataDespesas ?? []);

    // Carrega membros
    const { data: dataMembros } = await supabase
      .from('membros_grupo')
      .select('usuario_id, usuarios(nome_completo, telefone)')
      .eq('grupo_id', grupoId);
    
    if (dataMembros) {
      setMembros(dataMembros.map((m: any) => ({
        id: m.usuario_id,
        nome_completo: m.usuarios?.nome_completo || 'Usuário',
        telefone: m.usuarios?.telefone,
      })));
    }
  };



  const executarFechamento = async () => {
    setIsFechando(true);
    try {
      const { data, error } = await supabase.functions.invoke('calcular-balanco', {
        body: { grupoId }
      });
      if (error) throw error;
      
      const { acertos } = data;

      if (acertos && acertos.length > 0) {
        const novosAcertos = acertos.map((a: any) => ({
          grupo_id: grupoId,
          devedor_usuario_id: a.de,
          credor_usuario_id: a.para,
          valor: a.valor
        }));
        
        const { error: errAcertos } = await supabase.from('acertos').insert(novosAcertos);
        if (errAcertos) throw errAcertos;
      }

      const { error: errStatus } = await supabase.from('grupos').update({ status: 'fechado' }).eq('id', grupoId);
      if (errStatus) throw errStatus;

      setFeedback({ tipo: 'sucesso', texto: 'Conta fechada com sucesso! Os acertos foram gerados.' });
      setTimeout(() => setFeedback(null), 5000);
      
      carregar();
    } catch (e: any) {
      setFeedback({ tipo: 'erro', texto: `Erro ao fechar conta: ${e.message}` });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsFechando(false);
      setModalFechamentoVisivel(false);
    }
  };

  const fecharConta = () => {
    setModalFechamentoVisivel(true);
  };

  const confirmarAcerto = async () => {
    if (!acertoSelecionado) return;
    setIsConfirmandoAcerto(true);
    try {
      const { error } = await supabase
        .from('acertos')
        .update({ acertado_em: new Date().toISOString() })
        .eq('id', acertoSelecionado.id);
      if (error) throw error;
      setModalAcertoVisivel(false);
      setAcertoSelecionado(null);
      carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Recebimento confirmado com sucesso!' });
      setTimeout(() => setFeedback(null), 5000);
    } catch (e: any) {
      setFeedback({ tipo: 'erro', texto: `Erro ao confirmar acerto: ${e.message}` });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsConfirmandoAcerto(false);
    }
  };

  const executarExclusaoGrupo = async () => {
    setIsExcluindoGrupo(true);
    try {
      const { error } = await supabase.rpc('excluir_grupo_completo', {
        p_grupo_id: grupoId
      });
      if (error) throw error;
      
      setModalExclusaoGrupoVisivel(false);
      navigation.goBack();
    } catch (e: any) {
      setFeedback({ tipo: 'erro', texto: `Erro ao excluir grupo: ${e.message}` });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsExcluindoGrupo(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [grupoId, filtroData]));

  // Habilita Realtime Verdadeiro via WebSockets do Supabase
  useEffect(() => {
    const channel = supabase
      .channel(`public:despesas:grupo_id=eq.${grupoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'despesas', filter: `grupo_id=eq.${grupoId}` },
        () => {
          carregar(); // Recarrega as despesas em tempo real
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [grupoId, carregar]);

  const todosAcertosQuitados = acertos.length === 0 || acertos.every(a => a.acertado_em !== null);

  return (
    <View style={styles.container}>
      <FlatList
        data={despesas}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.titulo}>{nome}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {isAdmin && statusGrupo === 'aberto' && (
                  <TouchableOpacity style={[styles.btnFecharConta, isFechando && { opacity: 0.5 }]} onPress={fecharConta} disabled={isFechando}>
                    <Text style={styles.btnFecharContaTexto}>{isFechando ? 'Fechando...' : 'Fechar Conta'}</Text>
                  </TouchableOpacity>
                )}
                {isAdmin && statusGrupo === 'fechado' && todosAcertosQuitados && (
                  <TouchableOpacity style={[styles.btnExcluirGrupo, isExcluindoGrupo && { opacity: 0.5 }]} onPress={() => setModalExclusaoGrupoVisivel(true)} disabled={isExcluindoGrupo}>
                    <Text style={styles.btnExcluirGrupoTexto}>{isExcluindoGrupo ? 'Excluindo...' : 'Excluir Grupo'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

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

            <View style={styles.membrosContainer}>
              <Text style={styles.secao}>Membros ({membros.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membrosScroll}>
                {membros.map((m) => (
                  <TouchableOpacity 
                    key={m.id} 
                    style={styles.membroBadge}
                    onPress={() => navigation.navigate('MembroPerfil', { membro: m, grupoId, isAdmin: isAdmin && statusGrupo === 'aberto', isCriador: m.id === criadoPor })}
                  >
                    <Text style={styles.membroNome}>
                      {m.nome_completo.split(' ')[0]} {m.id === criadoPor && '(Admin)'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {isAdmin && statusGrupo === 'aberto' && (
                  <TouchableOpacity 
                    style={styles.btnAddMembro}
                    onPress={() => navigation.navigate('AdicionarMembro', { grupoId })}
                  >
                    <Text style={styles.btnAddMembroTexto}>+ Adicionar</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            <ResumoBalanco grupoId={grupoId} />

            {statusGrupo === 'fechado' && acertos.length > 0 && (
              <View style={styles.acertosContainer}>
                <Text style={styles.secao}>Acertos / Quitações</Text>
                {acertos.map(acerto => (
                  <View key={acerto.id} style={styles.acertoCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.acertoTexto}>
                        <Text style={styles.acertoDevedor}>{acerto.devedor.nome_completo}</Text> deve para <Text style={styles.acertoCredor}>{acerto.credor.nome_completo}</Text>
                      </Text>
                      <Text style={styles.acertoValor}>R$ {Number(acerto.valor).toFixed(2)}</Text>
                      {acerto.acertado_em ? (
                        <Text style={styles.acertoPagoTexto}>✅ Pago em {new Date(acerto.acertado_em).toLocaleDateString()}</Text>
                      ) : (
                        <Text style={styles.acertoPendenteTexto}>⏳ Pagamento Pendente</Text>
                      )}
                    </View>
                    
                    {!acerto.acertado_em && session?.user?.id === acerto.credor_usuario_id && (
                      <TouchableOpacity 
                        style={styles.btnConfirmarAcerto} 
                        onPress={() => {
                          setAcertoSelecionado(acerto);
                          setModalAcertoVisivel(true);
                        }}
                      >
                        <Text style={styles.btnConfirmarAcertoTexto}>Recebi</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.headerDespesas}>
              <Text style={styles.secao}>Despesas</Text>
              <View style={styles.filtrosContainer}>
                <TouchableOpacity onPress={() => setFiltroData('todas')} style={[styles.btnFiltro, filtroData === 'todas' && styles.btnFiltroAtivo]}>
                  <Text style={[styles.btnFiltroTexto, filtroData === 'todas' && styles.btnFiltroTextoAtivo]}>Todas</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFiltroData('30')} style={[styles.btnFiltro, filtroData === '30' && styles.btnFiltroAtivo]}>
                  <Text style={[styles.btnFiltroTexto, filtroData === '30' && styles.btnFiltroTextoAtivo]}>30 dias</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFiltroData('7')} style={[styles.btnFiltro, filtroData === '7' && styles.btnFiltroAtivo]}>
                  <Text style={[styles.btnFiltroTexto, filtroData === '7' && styles.btnFiltroTextoAtivo]}>7 dias</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma despesa ainda.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('EditarDespesa', { grupoId, despesaId: item.id, statusGrupo })}
          >
            <Text style={styles.desc}>{item.descricao}</Text>
            <Text style={styles.valor}>R$ {Number(item.valor).toFixed(2)}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
      {statusGrupo === 'aberto' && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CriarDespesa', { grupoId })}>
          <Text style={styles.fabTexto}>+ Nova despesa</Text>
        </TouchableOpacity>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE FECHAMENTO */}
      <Modal visible={modalFechamentoVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Fechar Conta</Text>
            <Text style={styles.modalDesc}>
              Deseja realmente fechar a conta? Não será mais possível adicionar ou editar despesas. Os acertos (dívidas) serão gerados automaticamente.
            </Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.modalBtnCancelar} onPress={() => setModalFechamentoVisivel(false)} disabled={isFechando}>
                <Text style={styles.modalBtnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirmar} onPress={executarFechamento} disabled={isFechando}>
                <Text style={styles.modalBtnConfirmarTexto}>{isFechando ? 'Fechando...' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE EXCLUSÃO DO GRUPO */}
      <Modal visible={modalExclusaoGrupoVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Excluir Grupo</Text>
            <Text style={styles.modalDesc}>
              A conta já foi fechada e todos os acertos estão quitados. Tem certeza que deseja excluir o grupo permanentemente? Todas as despesas e histórico serão apagados.
            </Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.modalBtnCancelar} onPress={() => setModalExclusaoGrupoVisivel(false)} disabled={isExcluindoGrupo}>
                <Text style={styles.modalBtnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirmar} onPress={executarExclusaoGrupo} disabled={isExcluindoGrupo}>
                <Text style={styles.modalBtnConfirmarTexto}>{isExcluindoGrupo ? 'Excluindo...' : 'Excluir'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE ACERTO */}
      <Modal visible={modalAcertoVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Confirmar Recebimento</Text>
            <Text style={styles.modalDesc}>
              Tem certeza que já recebeu os R$ {acertoSelecionado ? Number(acertoSelecionado.valor).toFixed(2) : '0.00'} de {acertoSelecionado?.devedor?.nome_completo}? Esta ação registrará a dívida como paga.
            </Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.modalBtnCancelar} onPress={() => {
                setModalAcertoVisivel(false);
                setAcertoSelecionado(null);
              }} disabled={isConfirmandoAcerto}>
                <Text style={styles.modalBtnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnConfirmar, { backgroundColor: '#2E7D32' }]} onPress={confirmarAcerto} disabled={isConfirmandoAcerto}>
                <Text style={styles.modalBtnConfirmarTexto}>{isConfirmandoAcerto ? 'Confirmando...' : 'Sim, recebi'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titulo: { fontSize: 22, fontWeight: '800', color: '#222', flex: 1 },
  btnFecharConta: { backgroundColor: '#F57C00', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnFecharContaTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnExcluirGrupo: { backgroundColor: '#C62828', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnExcluirGrupoTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secao: { fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 8 },
  membrosContainer: { marginBottom: 16 },
  membrosScroll: { flexDirection: 'row' },
  membroBadge: { backgroundColor: '#E0E0E0', paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderRadius: 16, marginRight: 8, flexDirection: 'row', alignItems: 'center' },
  membroNome: { color: '#333', fontSize: 13, fontWeight: '600' },
  btnAddMembro: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#2E7D32', justifyContent: 'center' },
  btnAddMembroTexto: { color: '#2E7D32', fontSize: 13, fontWeight: '700' },
  headerDespesas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  filtrosContainer: { flexDirection: 'row', gap: 6 },
  btnFiltro: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E0E0E0' },
  btnFiltroAtivo: { backgroundColor: '#2E7D32' },
  btnFiltroTexto: { fontSize: 12, color: '#555', fontWeight: '600' },
  btnFiltroTextoAtivo: { color: '#fff' },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  desc: { fontSize: 15, color: '#333' },
  valor: { fontWeight: '700', color: '#2E7D32' },
  vazio: { textAlign: 'center', color: '#999', marginTop: 20 },
  fab: { backgroundColor: '#2E7D32', padding: 16, alignItems: 'center', margin: 16, borderRadius: 12 },
  fabTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  acertosContainer: { marginTop: 16 },
  acertoCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#1976D2', elevation: 2 },
  acertoTexto: { fontSize: 15, color: '#444', marginBottom: 4 },
  acertoDevedor: { fontWeight: '700', color: '#C62828' },
  acertoCredor: { fontWeight: '700', color: '#2E7D32' },
  acertoValor: { fontSize: 20, fontWeight: '800', color: '#1976D2', marginBottom: 4 },
  acertoPagoTexto: { fontSize: 13, color: '#2E7D32', fontWeight: '600' },
  acertoPendenteTexto: { fontSize: 13, color: '#F57C00', fontWeight: '600' },
  btnConfirmarAcerto: { backgroundColor: '#2E7D32', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginLeft: 12 },
  btnConfirmarAcertoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
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