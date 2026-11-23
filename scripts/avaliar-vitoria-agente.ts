/**
 * A AVALIAÇÃO DA VITÓRIA AGENTE CONTRA A API REAL — d92 (23-11-2026).
 *
 * FORA DO AR E FORA DOS TESTES: só o CEO a corre, à mão, com a chave. Passa as
 * conversas de teste INVENTADAS (`src/lib/vitoria-agente/conversas-de-teste.ts`
 * — o caso que motivou a d92, a escolha simples e com condição, o IVA do
 * isento, as cargas, a limpeza, cancelar, a queixa, acima de 500 €, a conversa
 * em inglês, o código postal que chega tapado) pelo agente de verdade
 * (Claude Sonnet 5.5), com a base FINGIDA de cada caso — não lê nem escreve na
 * base, não envia nada a ninguém — em «low» e em «medium», e escreve um
 * relatório LOCAL: a resposta, a acção (responder / fecho / parceiro /
 * cancelar / equipa), se bate com o esperado, os tokens e o custo.
 *
 * Pára quando o gasto chega ao tecto (5 USD por omissão).
 *
 *   ANTHROPIC_API_KEY=… npx tsx scripts/avaliar-vitoria-agente.ts \
 *     --esforco low,medium --tecto 5 --vezes 1 --saida <pasta fora do repositório>
 *
 * Opcional: --env <ficheiro> lê a chave de um ficheiro KEY=VALOR, sem a
 * escrever em lado nenhum.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

type Esforco = "low" | "medium";
type Opcoes = { esforcos: Esforco[]; tecto: number; vezes: number; saida: string; env: string | null };

function lerOpcoes(argv: string[]): Opcoes {
  const valor = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const esforcos = String(valor("esforco") ?? "low,medium")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Esforco => s === "low" || s === "medium");
  return {
    esforcos: esforcos.length ? esforcos : ["medium"],
    tecto: Math.max(0.5, Math.min(5, Number(valor("tecto") ?? 5) || 5)),
    vezes: Math.max(1, Math.min(3, Number(valor("vezes") ?? 1) || 1)),
    saida: resolve(valor("saida") ?? tmpdir()),
    env: valor("env") ?? null,
  };
}

function carregarEnv(ficheiro: string) {
  for (const linha of readFileSync(ficheiro, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m || m[1] !== "ANTHROPIC_API_KEY" || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

async function principal() {
  const op = lerOpcoes(process.argv.slice(2));
  const repositorio = resolve(process.cwd());
  if (op.saida === repositorio || op.saida.startsWith(repositorio + sep)) {
    throw new Error("O relatório nunca fica no repositório (é público): use --saida com uma pasta de fora.");
  }
  if (op.env) carregarEnv(op.env);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY.");

  const { CONVERSAS_DE_TESTE, AGORA_DOS_CASOS, ferramentasDoCaso } = await import("../src/lib/vitoria-agente/conversas-de-teste");
  const { clienteDoClaude, correrOAgente } = await import("../src/lib/vitoria-agente/cliente");
  const cliente = clienteDoClaude();
  if (!cliente) throw new Error("Sem cliente do Claude.");

  let gasto = 0;
  const linhas: string[] = [];
  const resumo: Record<string, { certas: number; total: number; custoUsd: number }> = {};
  fora: for (const esforco of op.esforcos) {
    resumo[esforco] = { certas: 0, total: 0, custoUsd: 0 };
    for (let vez = 1; vez <= op.vezes; vez += 1) {
      for (const c of CONVERSAS_DE_TESTE) {
        if (gasto >= op.tecto) {
          linhas.push(`\n(parado: o gasto chegou ao tecto de ${op.tecto} USD)`);
          break fora;
        }
        const registo: string[] = [];
        const r = await correrOAgente(
          { conversa: c.conversa, pedidos: [c.pedidoId], agora: AGORA_DOS_CASOS, esforco },
          {
            cliente,
            // A base fingida do caso: nada se lê nem se escreve na base de verdade. O «aceitar» como ligado, para ver as acções.
            ferramentas: ferramentasDoCaso(c, { aoVivo: true, aceitarLigado: true }),
            gastoETecto: async () => ({ gastoUsd: gasto, tectoUsd: op.tecto }),
            registar: async (l) => {
              if (l.ferramenta !== "chamada") registo.push(`${l.ferramenta} ${JSON.stringify(l.entrada ?? "").slice(0, 160)}`);
            },
          },
        );
        gasto += r.custoUsd;
        const accao =
          r.estado === "equipa" ? "equipa" : r.estado !== "ok" ? r.estado : !r.pendente ? "responder" : r.pendente.tipo === "parceiro" ? "parceiro" : r.pendente.tipo;
        const texto = r.texto ?? r.mensagemDeEquipa ?? "";
        const falhas = [
          accao !== c.espera.accao ? `acção ${accao} (esperada ${c.espera.accao})` : null,
          ...(c.espera.contem ?? []).filter((s) => !texto.includes(s)).map((s) => `falta «${s}»`),
          ...(c.espera.naoContem ?? []).filter((s) => texto.includes(s)).map((s) => `tem «${s}»`),
        ].filter(Boolean);
        resumo[esforco].total += 1;
        if (falhas.length === 0) resumo[esforco].certas += 1;
        resumo[esforco].custoUsd += r.custoUsd;
        linhas.push(
          `\n## ${esforco} · ${c.nome}${op.vezes > 1 ? ` (vez ${vez})` : ""}`,
          `Cliente: ${c.conversa.at(-1)?.texto ?? ""}`,
          `Acção: ${accao} · ${falhas.length === 0 ? "BATE com o esperado" : `NÃO BATE: ${falhas.join("; ")}`}`,
          `Texto: ${texto || "(nenhum)"}`,
          `O que teria feito: ${r.teriaFeito.join(" · ") || "—"}`,
          `Recusadas pela guarda: ${r.recusadas.map((x) => x.motivo).join(" | ") || "—"}`,
          `Passos: ${registo.join(" → ") || "—"}`,
          `Idas: ${r.idas} · tokens ${r.uso.entrada}/${r.uso.saida} (cache lida ${r.uso.cacheLidos}) · ${r.custoUsd.toFixed(4)} USD`,
        );
      }
    }
  }

  const cabeca = [
    `# Avaliação da Vitória agente (d92) — ${new Date().toISOString()}`,
    `Conversas inventadas: ${CONVERSAS_DE_TESTE.length} · esforços: ${op.esforcos.join(", ")} · vezes: ${op.vezes} · tecto ${op.tecto} USD · gasto ${gasto.toFixed(4)} USD`,
    ...Object.entries(resumo).map(
      ([e, v]) => `- ${e}: ${v.certas}/${v.total} batem com o esperado · ${v.custoUsd.toFixed(4)} USD (${v.total ? (v.custoUsd / v.total).toFixed(4) : "0"} por conversa)`,
    ),
    "",
    "Escolher o esforço pela QUALIDADE (o texto e a acção), não só pelo número que bate: ler as respostas abaixo.",
  ];
  if (!existsSync(op.saida)) mkdirSync(op.saida, { recursive: true });
  const ficheiro = join(op.saida, `avaliacao-vitoria-agente-${Date.now()}.md`);
  writeFileSync(ficheiro, [...cabeca, ...linhas].join("\n"), "utf8");
  console.log(cabeca.join("\n"));
  console.log(`\nRelatório: ${ficheiro}`);
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
