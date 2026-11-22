/**
 * A MEDIÇÃO DA VITÓRIA AGENTE — d85, fase 0 (22-11-2026).
 *
 * FORA DO AR: corre-se à mão, quando houver a chave, pelo CEO com o dono.
 * Pega em N conversas reais da base, tira-lhes os dados de pessoas (nomes,
 * telefones, emails, NIF, IBAN, códigos postais, a rua), passa cada uma pelo
 * agente em ensaio (com «low» e/ou «medium») e escreve um relatório LOCAL com
 * os tokens e o custo por conversa e o custo mensal projectado.
 *
 * Não escreve NADA na base nem envia nada a ninguém: as ferramentas só lêem,
 * e o registo das acções fica no relatório. Pára quando o gasto chega ao
 * tecto (20 USD por omissão).
 *
 *   DATABASE_URL=… ANTHROPIC_API_KEY=… npx tsx scripts/medir-vitoria-agente.ts \
 *     --conversas 20 --esforco low,medium --tecto 20 --saida <pasta fora do repositório>
 *
 * Opcional: --env <ficheiro> lê as variáveis de um ficheiro KEY=VALOR (por
 * exemplo o de `vercel env pull`), sem as escrever em lado nenhum.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

type Opcoes = { conversas: number; esforcos: Array<"low" | "medium">; tecto: number; saida: string; env: string | null };

function lerOpcoes(argv: string[]): Opcoes {
  const valor = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const esforcos = String(valor("esforco") ?? "low,medium")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is "low" | "medium" => s === "low" || s === "medium");
  return {
    conversas: Math.max(1, Math.min(200, Number(valor("conversas") ?? 20) || 20)),
    esforcos: esforcos.length ? esforcos : ["low"],
    tecto: Math.max(0.5, Math.min(50, Number(valor("tecto") ?? 20) || 20)),
    saida: resolve(valor("saida") ?? tmpdir()),
    env: valor("env") ?? null,
  };
}

function carregarEnv(ficheiro: string) {
  for (const linha of readFileSync(ficheiro, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

/** Quantas mensagens do cliente (rajadas) houve nos últimos 30 dias — para projectar o mês. */
function contarRajadas(linhas: Array<{ telefone: string; direccao: string }>): number {
  const ultimaDe = new Map<string, string>();
  let n = 0;
  for (const l of linhas) {
    const t = l.telefone.slice(-9);
    if (l.direccao === "in" && ultimaDe.get(t) !== "in") n += 1;
    ultimaDe.set(t, l.direccao);
  }
  return n;
}

async function principal() {
  const op = lerOpcoes(process.argv.slice(2));
  const repositorio = resolve(process.cwd());
  if (op.saida === repositorio || op.saida.startsWith(repositorio + sep)) {
    throw new Error("O relatório nunca fica no repositório (é público): use --saida com uma pasta de fora.");
  }
  if (op.env) carregarEnv(op.env);
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY.");

  const db = await import("../src/lib/db");
  const { partirNaUltimaDoCliente, ferramentasDeVerdade } = await import("../src/lib/vitoria-agente/na-base");
  const { conversaAnonimizada } = await import("../src/lib/vitoria-agente/anonimizar");
  const { clienteDoClaude, correrOAgente } = await import("../src/lib/vitoria-agente/cliente");
  const { custoMensalProjectado } = await import("../src/lib/vitoria-agente/custo");
  const neg = await import("../src/lib/whatsapp-negociacao");

  const pool = await db.getPool();
  if (!pool) throw new Error("Sem ligação à base.");
  const cliente = clienteDoClaude();
  if (!cliente) throw new Error("Sem cliente do Claude.");

  const [recentes] = (await pool.execute(
    `SELECT telefone, direccao FROM whatsappMensagens WHERE criadoEm >= UTC_TIMESTAMP() - INTERVAL 30 DAY ORDER BY id ASC`,
  )) as [Array<{ telefone: string; direccao: string }>, unknown];
  const rajadasNoMes = contarRajadas(recentes.map((r) => ({ telefone: String(r.telefone ?? ""), direccao: String(r.direccao ?? "") })));

  const [numeros] = (await pool.execute(
    `SELECT RIGHT(telefone, 9) AS fim, MAX(telefone) AS telefone, MAX(id) AS ultimo
       FROM whatsappMensagens WHERE direccao = 'in' AND criadoEm >= UTC_TIMESTAMP() - INTERVAL 30 DAY
      GROUP BY RIGHT(telefone, 9) ORDER BY ultimo DESC LIMIT ${op.conversas}`,
  )) as [Array<{ telefone: string }>, unknown];

  let gasto = 0;
  const resultados: Array<Record<string, unknown>> = [];
  for (const [i, n] of numeros.entries()) {
    const telefone = String(n.telefone);
    const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40);
    const partido = partirNaUltimaDoCliente(fio);
    if (!partido) continue;
    const pedidos = await neg.pedidosDoTelefone(telefone).catch(() => [] as number[]);
    const quem: Array<{ contactName: string | null; address: string | null }> = [];
    for (const id of pedidos.slice(0, 5)) {
      const p = await db.getSimulatorOrderById(id).catch(() => undefined);
      if (p) quem.push({ contactName: p.contactName ?? null, address: p.address ?? null });
    }
    const conversa = conversaAnonimizada(partido.conversa, quem);
    for (const esforco of op.esforcos) {
      if (gasto >= op.tecto) break;
      const accoes: unknown[] = [];
      const agora = new Date();
      const r = await correrOAgente(
        { conversa, pedidos, agora, esforco },
        {
          cliente,
          ferramentas: await ferramentasDeVerdade(telefone, agora, quem),
          gastoETecto: async () => ({ gastoUsd: gasto, tectoUsd: op.tecto }),
          registar: async (l) => {
            accoes.push({ ferramenta: l.ferramenta, entrada: l.entrada, erro: l.erro ?? null, custoUsd: l.custoUsd ?? 0 });
          },
        },
      );
      gasto += r.custoUsd;
      // Sem telefone nem número de pedido no relatório: a conversa n.º i.
      resultados.push({
        conversa: i + 1,
        esforco,
        estado: r.estado,
        motivo: r.motivo,
        respostaDoAgente: r.texto,
        teriaFeito: r.teriaFeito,
        recusadasPelaGuarda: r.recusadas.length,
        idas: r.idas,
        tokens: r.uso,
        custoUsd: r.custoUsd,
        accoes,
      });
      console.log(`conversa ${i + 1} (${esforco}): ${r.estado} · ${r.custoUsd.toFixed(4)} USD · cache ${r.uso.cacheLidos}`);
    }
    if (gasto >= op.tecto) {
      console.log(`Tecto de ${op.tecto} USD atingido — paro aqui.`);
      break;
    }
  }

  const porEsforco = Object.fromEntries(
    op.esforcos.map((e) => {
      const ls = resultados.filter((r) => r.esforco === e);
      const custos = ls.map((r) => Number(r.custoUsd));
      const tokens = ls.map((r) => r.tokens as { entrada: number; saida: number; cacheLidos: number; cacheEscritos: number });
      const media = (f: (t: (typeof tokens)[number]) => number) => (tokens.length ? Math.round(tokens.reduce((s, t) => s + f(t), 0) / tokens.length) : 0);
      return [
        e,
        {
          conversas: ls.length,
          ok: ls.filter((r) => r.estado === "ok").length,
          equipa: ls.filter((r) => r.estado === "equipa").length,
          bloqueadas: ls.filter((r) => r.estado === "bloqueado").length,
          erros: ls.filter((r) => r.estado === "erro" || r.estado === "recusou").length,
          custoMedioUsd: custos.length ? Math.round((custos.reduce((s, c) => s + c, 0) / custos.length) * 10000) / 10000 : 0,
          tokensMediosEntrada: media((t) => t.entrada),
          tokensMediosSaida: media((t) => t.saida),
          tokensMediosCacheLidos: media((t) => t.cacheLidos),
          custoMensalProjectadoUsd: custoMensalProjectado(custos, rajadasNoMes),
        },
      ];
    }),
  );
  const relatorio = { em: new Date().toISOString(), modelo: "claude-sonnet-5-5", rajadasNoMes, gastoUsd: Math.round(gasto * 10000) / 10000, porEsforco, resultados };
  if (!existsSync(op.saida)) mkdirSync(op.saida, { recursive: true });
  const ficheiro = join(op.saida, `vitoria-agente-medicao-${relatorio.em.slice(0, 10)}.json`);
  writeFileSync(ficheiro, JSON.stringify(relatorio, null, 2), "utf8");
  console.log(`\nGasto: ${relatorio.gastoUsd} USD. Relatório: ${ficheiro}`);
  console.log(JSON.stringify(porEsforco, null, 2));
  await pool.end().catch(() => {});
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
