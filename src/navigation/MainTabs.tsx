import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { GruposListScreen } from '../screens/grupos/GruposListScreen';
import { CriarGrupoScreen } from '../screens/grupos/CriarGrupoScreen';
import { GrupoDetalheScreen } from '../screens/grupos/GrupoDetalheScreen';
import { CriarDespesaScreen } from '../screens/despesas/CriarDespesaScreen';
import { EditarDespesaScreen } from '../screens/despesas/EditarDespesaScreen';
import { PerfilScreen } from '../screens/perfil/PerfilScreen';
import { AdicionarMembroScreen } from '../screens/grupos/AdicionarMembroScreen';
import { MembroPerfilScreen } from '../screens/grupos/MembroPerfilScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function GruposStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="GruposLista" component={GruposListScreen} options={{ title: 'Meus Grupos' }} />
      <Stack.Screen name="CriarGrupo" component={CriarGrupoScreen} options={{ title: 'Novo Grupo' }} />
      <Stack.Screen name="GrupoDetalhe" component={GrupoDetalheScreen} options={{ title: 'Grupo' }} />
      <Stack.Screen name="CriarDespesa" component={CriarDespesaScreen} options={{ title: 'Nova Despesa' }} />
      <Stack.Screen name="EditarDespesa" component={EditarDespesaScreen} options={{ title: 'Editar Despesa' }} />
      <Stack.Screen name="AdicionarMembro" component={AdicionarMembroScreen} options={{ title: 'Adicionar Membro' }} />
      <Stack.Screen name="MembroPerfil" component={MembroPerfilScreen} options={{ title: 'Perfil do Membro' }} />
    </Stack.Navigator>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2E7D32',
        tabBarIcon: ({ color, size }) => {
          const nome = route.name === 'Grupos' ? 'people' : 'person';
          return <Ionicons name={nome as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Grupos" component={GruposStack} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}