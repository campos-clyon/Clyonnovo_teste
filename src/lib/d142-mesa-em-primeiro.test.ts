import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d142 (27-11-2026, dono): na Mesa, a mesa de trabalho em destaque e em
 * primeiro — o filtro, os cartões dos números, o registo e os blocos. O
 * «Precisa de si», as propostas há mais de 24 h, o «Do nosso lado» e os
 * fechados da semana passam a botões pequenos numa linha discreta, com o
 * contador; ao carregar, o conteúdo de antes abre por baixo da linha.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const SHELL = ler("src/components/admin/LegacyAdminClient.tsx");
const PRECISA = ler("src/components/admin/PrecisaDeSiNaMesa.tsx");
const PROPOSTAS = ler("src/components/admin/PropostasSemResposta.tsx");
const LADO = ler("src/components/admin/DoNossoLado.tsx");
const MOTIVOS = ler("src/components/admin/MotivosDaSemana.tsx");
const LINHA = ler("src/components/admin/linhaDaMesa.ts");

describe("d142 — a mesa em primeiro", () => {
  it("nada fica por cima do filtro: o «Precisa de si» já não abre a secção da Mesa", () => {
    const i = SHELL.indexOf('{activeSection === "negociacoes_clyon" && (');
    const antes = SHELL.slice(i, SHELL.indexOf("<AdminNegociacoesPanel", i));
    expect(antes).not.toContain("<PrecisaDeSiNaMesa");
    expect(SHELL.slice(i, SHELL.indexOf("</section>", i))).toContain("linhaDoPrecisaDeSi={linhaDoPrecisaDeSi}");
    expect(SHELL).toContain("const linhaDoPrecisaDeSi = <PrecisaDeSiNaMesa onAbrir=");
  });

  it("a linha discreta vem depois do filtro e antes dos cartões dos números, com tudo o que estava no topo", () => {
    const filtro = MESA.indexOf('aria-label="Filtrar por profissional"');
    const linha = MESA.indexOf('aria-label="O que está à espera"');
    const cartoes = MESA.indexOf("onClick={() => escolherBloco(null)}");
    expect(filtro).toBeGreaterThan(-1);
    expect(linha).toBeGreaterThan(filtro);
    expect(cartoes).toBeGreaterThan(linha);
    const bloco = MESA.slice(linha, cartoes);
    expect(bloco).toContain("{linhaDoPrecisaDeSi}");
    expect(bloco).toContain("<DoNossoLado");
    expect(bloco).toContain("<MotivosDaSemana");
    expect(bloco).toContain("flex flex-wrap");
    // Só uma vez cada um: saíram de cima do filtro.
    expect(MESA.split("<DoNossoLado").length).toBe(2);
    expect(MESA.split("<MotivosDaSemana").length).toBe(2);
  });

  it("o conteúdo aberto vai para o fim da linha, a toda a largura", () => {
    expect(LINHA).toContain('PAINEL_DA_LINHA = "order-last basis-full');
    for (const f of [PRECISA, PROPOSTAS, LADO, MOTIVOS]) {
      expect(f).toContain("PAINEL_DA_LINHA");
      expect(f).toContain("BOTAO_DA_LINHA");
      expect(f).toContain("aria-expanded=");
    }
  });

  it("nada se perde: os chips, os contadores, a lista dos sem valor e o «Copiar mensagem»", () => {
    for (const t of ["atrasados", "à espera de si", "por transferir", "por enviar", "sem dia marcado", "aceites sem rua", "candidaturas", "por aprovar", "fora da grelha (semana)"]) {
      expect(PRECISA).toContain(`titulo: "${t}"`);
    }
    expect(PRECISA).toContain("onClick={() => onAbrir(c.seccao)}");
    expect(PRECISA).toContain("{semValor.length}");
    expect(PRECISA).toContain("sem valor há mais de {HORAS_SEM_VALOR} h");
    expect(PRECISA).toContain("<PropostasSemResposta");
    expect(PROPOSTAS).toContain("{lista.length}");
    expect(PROPOSTAS).toContain("Propostas há mais de 24 h sem resposta do cliente");
    expect(PROPOSTAS).toContain("Copiar mensagem");
    expect(LADO).toContain("{g.linhas.length}");
    expect(LADO).toContain("{g.titulo}");
    expect(LADO).toContain("Copiar o texto");
    expect(LADO).toContain("<AvisosDaEquipa token={token} />");
    expect(MOTIVOS).toContain("Fechados nos últimos 7 dias");
  });

  it("cada grupo do «Do nosso lado» tem o seu rótulo curto", () => {
    for (const t of ["conversa", "preco_clyon", "propostas", "data_passada", "sem_resposta", "sem_fecho", "sem_propostas", "mudanca_sem_valor"]) {
      expect(LADO).toMatch(new RegExp(`\\n  ${t}: "`));
    }
    expect(LADO).toContain("const ROTULO_CURTO: Record<TipoDoNossoLado, string>");
  });

  it("os botões nascem fechados (nada abre sozinho ao entrar)", () => {
    expect(PRECISA).toContain("useState(false)");
    expect(PROPOSTAS).toContain("const [aberto, setAberto] = useState(false);");
    expect(LADO).toContain("const [abertos, setAbertos] = useState<Set<string>>(new Set());");
  });
});
