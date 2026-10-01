import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Um pedido que não ficou gravado não pode acabar num ecrã de sucesso.
 *
 * Os dois formulários de pedido do site mostravam "Pedido enviado" quando a
 * base falhava: o da página inicial porque a rota respondia sempre {ok: true};
 * o simulador porque ia "sempre para o ecrã de sucesso", com o número #-1 e a
 * promessa de um email que nunca ia sair. O cliente ficava à espera de
 * propostas que não podiam chegar, e ninguém sabia dele.
 *
 * E a volta: as respostas em HTML (413, 504) que viravam "erro de rede", o
 * 429 que dizia "veja o seu email", e os textos que prometiam o que o código
 * não faz.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** Sem os comentários: o que eles CONTAM não pode fazer um teste passar ou chumbar. */
const semNotas = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA_HERO = ler("src/app/api/hero-quote/route.ts");
const HERO = ler("src/components/HeroQuoteForm.tsx");
const SIMULADOR = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
const PLATAFORMA = ler("src/app/plataforma/pedir/FormularioDePedido.tsx");
const ROTA_PEDIDO = ler("src/app/api/simulador/pedido/route.ts");

describe("o formulário da página inicial", () => {
  it("a rota devolve 500 quando nem o pedido nem o lead ficaram gravados", () => {
    expect(ROTA_HERO).toContain("leadGravado = true;");
    expect(ROTA_HERO).toContain("if (!pedidoGravado && !leadGravado) {");
    expect(ROTA_HERO).toMatch(/error: NADA_GRAVADO \}, \{ status: 500 \}/);
    expect(ROTA_HERO).toContain(
      "Não foi possível registar o pedido. Tente novamente ou fale connosco por WhatsApp.",
    );
  });

  it("o erro aparece com o caminho do WhatsApp", () => {
    expect(HERO).toContain("href={WHATSAPP_DA_FALHA}");
    // Sem o 351 repetido: o BUSINESS_PHONE já o traz.
    expect(HERO).toContain('`https://wa.me/${BUSINESS_PHONE.replace(/\\D/g, "")}');
  });

  it("os erros do servidor vão para o campo a que pertencem", () => {
    expect(HERO).toContain("Object.entries(data.details ?? {})");
    expect(HERO).toContain("if (CAMPOS_DO_PASSO_1.some((c) => porCampo[c])) setStep(1);");
    // As mensagens da rota estão em português, e não as do zod por omissão.
    expect(ROTA_HERO).toContain('z.string().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres")');
  });

  it("os máximos do servidor também estão no formulário", () => {
    expect((HERO.match(/maxLength=\{60\}/g) ?? []).length).toBe(2);
    expect(HERO).toContain("maxLength={200}");
    expect(HERO).toContain("maxLength={20}");
  });

  it("uma resposta que não é JSON não passa por falta de rede", () => {
    expect(HERO).toContain("await res.json().catch(() => ({}))");
  });

  it("o ecrã de sucesso diz as mesmas 6 horas duas vezes", () => {
    expect(semNotas(HERO)).not.toContain("&lt;24");
    expect(HERO).toContain("{PRAZO_DE_RESPOSTA.frase}");
  });
});

describe("o simulador", () => {
  it("já não vai para o ecrã de sucesso com o pedido por gravar", () => {
    expect(SIMULADOR).not.toContain("savedId ?? -1");
    expect(SIMULADOR).toContain('if (!("id" in resultado)) {');
    expect(SIMULADOR).toContain("setFalhaNoEnvio(");
  });

  it("a falha tem duas saídas: tentar outra vez, sem perder nada, e o WhatsApp", () => {
    const LIMPO = semNotas(SIMULADOR);
    expect(LIMPO).toContain("Não foi possível enviar o pedido.");
    expect(LIMPO).toContain("Tentar outra vez");
    expect(LIMPO).toContain("onClick={handleAnalyze}");
    expect(LIMPO).toContain("${WHATSAPP_CLYON}?text=");
    // As fotos que já subiram não voltam a subir na segunda tentativa.
    expect(SIMULADOR).toContain("fotosJaEnviadas.current.get(original)");
  });

  it("o email só se promete quando o servidor o vai mandar", () => {
    expect(ROTA_PEDIDO).toContain("emailDoLink,");
    expect(ROTA_PEDIDO).toContain(
      'valorDeArranque != null && contactEmail && contactEmail.includes("@") ? contactEmail : null',
    );
    const LIMPO = semNotas(SIMULADOR);
    expect(LIMPO).toContain("{emailDoLink ? (");
    expect(LIMPO).toContain("Sem email, as propostas chegam-lhe por WhatsApp ou por telefone");
  });

  it("não diz que os profissionais já receberam, nem que a CLYON telefona", () => {
    const LIMPO = semNotas(SIMULADOR);
    expect(LIMPO).not.toContain("Profissionais da sua zona receberam o pedido");
    expect(LIMPO).not.toContain("irá analisar os dados e entrar em contacto");
    expect(LIMPO).toContain("A CLYON confere o pedido e envia-o aos profissionais da sua zona");
  });

  it("uma resposta que não é JSON não passa por falta de rede", () => {
    expect(SIMULADOR).toContain("await saveRes.json().catch(() => ({}))");
  });
});

describe("o formulário da plataforma, que tinha o mesmo defeito", () => {
  it("também já não mostra sucesso sem pedido", () => {
    expect(PLATAFORMA).not.toContain("savedId ?? -1");
    expect(semNotas(PLATAFORMA)).toContain("Tentar outra vez");
    expect(PLATAFORMA).toContain("await saveRes.json().catch(() => ({}))");
  });
});

describe("os contactos", () => {
  it("não prometem que um profissional telefona", () => {
    const LIMPO = semNotas(ler("src/app/contactos/ContactosClient.tsx"));
    expect(LIMPO).not.toContain("O profissional entra em contacto");
    expect(LIMPO).toContain("A CLYON confere o pedido e envia-o aos profissionais da sua zona.");
  });
});

describe("as outras respostas que não são JSON", () => {
  it.each([
    "src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx",
    "src/app/orcamento/[token]/OrcamentoClient.tsx",
  ])("%s lê o corpo com catch", (f) => {
    expect(ler(f)).toContain("await res.json().catch(() => ({}))");
  });
});

describe("o link de entrada por email", () => {
  it("um 429 não diz «veja o seu email»", () => {
    const CARTAO = ler("src/app/entrar/PremiumLoginCard.tsx");
    expect(CARTAO).toContain("travado = res.status === 429;");
    expect(CARTAO).toContain("Demasiados pedidos. Aguarde alguns minutos e tente de novo.");
    expect(CARTAO).toContain("if (travado) setDemasiados(true);");
  });
});
