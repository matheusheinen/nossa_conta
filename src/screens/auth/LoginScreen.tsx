import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

function traduzirErro(mensagem: string): string {
  const traducoes: [string, string][] = [
    ['Invalid login credentials', 'Email ou senha incorretos'],
    ['Email not confirmed', 'Email não confirmado. Verifique sua caixa de entrada.'],
    ['Invalid Refresh Token', 'Sessão expirada. Faça login novamente.'],
    ['For security purposes, you can only request this after', 'Por segurança, aguarde um momento antes de tentar novamente'],
    ['Email rate limit exceeded', 'Muitas tentativas. Aguarde um momento antes de tentar novamente'],
  ];
  for (const [en, pt] of traducoes) {
    if (mensagem.includes(en)) return pt;
  }
  return mensagem;
}

export function LoginScreen({ navigation }: any) {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  const handleEmailChange = (texto: string) => {
    setEmail(texto);
    if (erroLogin) setErroLogin(null);
  };

  const handleSenhaChange = (texto: string) => {
    setSenha(texto);
    if (erroLogin) setErroLogin(null);
  };

  const handleEntrar = async () => {
    if (!email.trim() || !senha) {
      setErroLogin('Preencha email e senha');
      return;
    }
    try {
      setCarregando(true);
      setErroLogin(null);
      await entrar(email.trim(), senha);
    } catch (e: any) {
      const msg = traduzirErro(e.message);
      setErroLogin(msg);
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>NossaConta</Text>
      <Text style={styles.subtitulo}>Divida despesas sem complicação</Text>

      <TextInput
        style={[styles.input, erroLogin && styles.inputErro]}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={handleEmailChange}
      />
      <TextInput
        style={[styles.input, erroLogin && styles.inputErro]}
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={handleSenhaChange}
      />

      {erroLogin && (
        <Text style={styles.erroTexto}>⚠️ {erroLogin}</Text>
      )}

      <TouchableOpacity style={styles.botao} onPress={handleEntrar} disabled={carregando}>
        <Text style={styles.botaoTexto}>{carregando ? 'Entrando...' : 'Entrar'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Cadastro')}>
        <Text style={styles.link}>Não tem conta? Cadastre-se</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  logo: { fontSize: 32, fontWeight: '800', color: '#2E7D32', textAlign: 'center' },
  subtitulo: { textAlign: 'center', color: '#666', marginBottom: 32 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14,
    marginBottom: 12, fontSize: 16,
  },
  inputErro: {
    borderColor: '#C62828',
  },
  erroTexto: {
    color: '#C62828', fontSize: 14, marginBottom: 8, textAlign: 'center', fontWeight: '500',
  },
  botao: {
    backgroundColor: '#2E7D32', padding: 16, borderRadius: 10,
    alignItems: 'center', marginTop: 8,
  },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: '#2E7D32', marginTop: 20, fontWeight: '600' },
});