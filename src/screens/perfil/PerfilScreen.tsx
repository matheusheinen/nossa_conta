import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export function PerfilScreen() {
  const { session, sair } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Perfil</Text>
      <Text style={styles.email}>{session?.user.email}</Text>
      <TouchableOpacity style={styles.botao} onPress={sair}>
        <Text style={styles.botaoTexto}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  titulo: { fontSize: 24, fontWeight: '800', color: '#222', textAlign: 'center' },
  email: { textAlign: 'center', color: '#666', marginVertical: 16 },
  botao: { backgroundColor: '#C62828', padding: 16, borderRadius: 10, alignItems: 'center' },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});