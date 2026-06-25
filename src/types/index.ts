export interface Usuario {
  id: string;
  email: string;
  nome_completo: string;
  url_avatar?: string;
}

export interface Grupo {
  id: string;
  nome: string;
  descricao?: string;
  criado_por: string;
  criado_em: string;
}

export interface Membro {
  id: string;
  nome_completo: string;
  telefone?: string;
}

export interface Despesa {
  id: string;
  grupo_id: string;
  pago_por_usuario_id: string;
  descricao: string;
  valor: number;
  url_comprovante?: string;
  criado_em: string;
}

export interface Acerto {
  de: string;
  para: string;
  valor: number;
}

export interface ResultadoBalanco {
  success: boolean;
  grupo_id: string;
  saldos: Record<string, number>;
  acertos: Acerto[];
  calculado_em: string;
}