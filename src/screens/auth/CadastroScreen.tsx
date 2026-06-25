import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

function traduzirErro(mensagem: string): string {
  const traducoes: [string, string][] = [
    ['User already registered', 'Este email já está cadastrado'],
    ['Password should be at least 6 characters', 'A senha deve ter pelo menos 6 caracteres'],
    ['Unable to validate email address: invalid format', 'Formato de email inválido'],
    ['For security purposes, you can only request this after', 'Por segurança, aguarde um momento antes de tentar novamente'],
    ['Email rate limit exceeded', 'Muitas tentativas. Aguarde um momento antes de tentar novamente'],
  ];
  for (const [en, pt] of traducoes) {
    if (mensagem.includes(en)) return pt;
  }
  return mensagem;
}

export function CadastroScreen({ navigation }: any) {
  const { cadastrar } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const mascaraTelefone = (t: string) => {
    let raw = t.replace(/\D/g, '');
    if (raw.length > 11) raw = raw.slice(0, 11);
    if (raw.length > 2) raw = `(${raw.slice(0, 2)}) ` + raw.slice(2);
    if (raw.length > 10) raw = raw.slice(0, 10) + '-' + raw.slice(10);
    return raw;
  };

  const handleCadastrar = async () => {
    if (!nome.trim() || !email.trim() || !telefone.trim() || senha.length < 6) {
      Alert.alert('Erro', 'Preencha todos os campos. A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    
    // Remove a máscara antes de salvar no banco
    const telefoneNumeros = telefone.replace(/\D/g, '');
    
    try {
      setCarregando(true);
      const resultado = await cadastrar(email.trim(), senha, nome.trim(), telefoneNumeros);

      if (resultado.confirmacaoPendente) {
        // Supabase está exigindo confirmação de email
        Alert.alert(
          'Verifique seu email',
          'Enviamos um link de confirmação para o seu email. Confirme antes de fazer login.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Confirmação de email desativada — sessão criada automaticamente
        Alert.alert('Pronto!', 'Conta criada com sucesso!');
      }
    } catch (e: any) {
      Alert.alert('Erro ao cadastrar', traduzirErro(e.message));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Criar conta</Text>

      <TextInput style={styles.input} placeholder="Nome completo" value={nome} onChangeText={setNome} />
      <TextInput
        style={styles.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail}
      />
      <TextInput
        style={styles.input} placeholder="Telefone (WhatsApp)" keyboardType="phone-pad"
        value={telefone} onChangeText={(t) => setTelefone(mascaraTelefone(t))}
      />
      <TextInput style={styles.input} placeholder="Senha (mín. 6)" secureTextEntry value={senha} onChangeText={setSenha} />

      <TouchableOpacity style={styles.botao} onPress={handleCadastrar} disabled={carregando}>
        <Text style={styles.botaoTexto}>{carregando ? 'Criando...' : 'Cadastrar'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Já tenho conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  titulo: { fontSize: 28, fontWeight: '800', color: '#2E7D32', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16 },
  botao: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: '#2E7D32', marginTop: 20, fontWeight: '600' },
});