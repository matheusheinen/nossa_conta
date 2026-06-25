import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// IMPORTANTE: usa a SERVICE_ROLE (injetada automaticamente pelo Supabase).
// Ela roda no servidor e ignora o RLS com segurança — a chave anônima NÃO
// conseguiria ler os dados sob RLS.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { grupoId } = await req.json();
    if (!grupoId) {
      return json({ error: "grupoId é obrigatório" }, 400);
    }

    const { data: despesas, error: e1 } = await supabase
      .from("despesas")
      .select("id, pago_por_usuario_id, valor")
      .eq("grupo_id", grupoId);
    if (e1) throw e1;

    const despesaIds = despesas?.map((d) => d.id) ?? [];

    const { data: membros } = await supabase
      .from("membros_grupo")
      .select("usuario_id")
      .eq("grupo_id", grupoId);

    // Se não há despesas, retorna balanço zerado
    if (despesaIds.length === 0) {
      return json({
        success: true,
        grupo_id: grupoId,
        saldos: Object.fromEntries((membros ?? []).map((m) => [m.usuario_id, 0])),
        acertos: [],
        calculado_em: new Date().toISOString(),
      });
    }

    const { data: divisoes, error: e2 } = await supabase
      .from("divisoes_despesa")
      .select("despesa_id, usuario_id, valor_devido")
      .in("despesa_id", despesaIds);
    if (e2) throw e2;

    // Inicializa saldos
    const saldos: Record<string, number> = {};
    membros?.forEach((m) => { saldos[m.usuario_id] = 0; });

    // Processa cada divisão
    divisoes?.forEach((div) => {
      const despesa = despesas?.find((d) => d.id === div.despesa_id);
      if (!despesa) return;
      const pagou = despesa.pago_por_usuario_id;
      const deve = div.usuario_id;
      const v = Number(div.valor_devido);
      saldos[pagou] = (saldos[pagou] ?? 0) + v;  // quem pagou recebe crédito
      saldos[deve] = (saldos[deve] ?? 0) - v;    // quem participou fica devendo
    });

    const acertos = calcularAcertosOtimos(saldos);

    return json({
      success: true,
      grupo_id: grupoId,
      saldos,
      acertos,
      calculado_em: new Date().toISOString(),
    });
  } catch (error: any) {
    return json({ error: error.message ?? "Erro ao calcular balanço" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// Minimiza o número de transferências entre devedores e credores
function calcularAcertosOtimos(saldos: Record<string, number>) {
  const credores: Array<[string, number]> = [];
  const devedores: Array<[string, number]> = [];

  Object.entries(saldos).forEach(([usuario, saldo]) => {
    const s = Math.round(saldo * 100) / 100;
    if (s > 0.01) credores.push([usuario, s]);
    else if (s < -0.01) devedores.push([usuario, -s]);
  });

  const acertos: Array<{ de: string; para: string; valor: number }> = [];
  while (credores.length && devedores.length) {
    const [credor, credito] = credores[0];
    const [devedor, debito] = devedores[0];
    const valor = Math.min(credito, debito);

    acertos.push({ de: devedor, para: credor, valor: Math.round(valor * 100) / 100 });

    credores[0][1] -= valor;
    devedores[0][1] -= valor;
    if (credores[0][1] < 0.01) credores.shift();
    if (devedores[0][1] < 0.01) devedores.shift();
  }
  return acertos;
}