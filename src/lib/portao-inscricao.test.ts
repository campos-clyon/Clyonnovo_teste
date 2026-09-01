import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O portão do formulário e o portão do botão dele têm de ser o mesmo.
 *
 * O QUE ACONTECEU
 *
 * A página da inscrição — `/profissionais/...` — estava atrás da CHAVE. O
 * endpoint que o botão dela chama, `/api/profissionais/inscricao`, estava atrás
 * da chave MAIS uma sessão de testador.
 *
 * Um profissional convidado chegava ao formulário (tem a chave, veio pelo
 * link), preenchia os dez campos, carregava em "Quero receber pedidos" — e o
 * middleware devolvia 404 SEM CORPO, porque para rotas `/api/` responde-se com
 * um código e não com um desvio para o ecrã de entrada.
 *
 * O formulário faz `res.json()` a essa resposta vazia. O parse estoira, cai no
 * `catch`, e o ecrã diz "Erro de rede. Verifique a ligação e tente novamente."
 *
 * Ou seja: dizia-se ao profissional que a ligação dele estava avariada. Ele
 * tentava outra vez, e outra — e à quinta apanhava o limite de cinco pedidos
 * por dez minutos, que é a única mensagem que teria sido verdadeira.
 *
 * PORQUE É QUE É SEGURO BAIXAR O PORTÃO
 *
 * Foi-o primeiro porque a inscrição exigia convite, e a rota validava um token
 * de 256 bits guardado só em hash — uma credencial mais forte do que a
 * palavra-passe de um testador.
 *
 * A 01-09-2026 a candidatura abriu ao público: o botão «Tornar-me parceiro» da
 * homepage deixou de ir para o WhatsApp e passou a abrir o formulário. O que
 * segura a porta deixou de ser o convite e passou a ser o ESTADO do que aqui se
 * escreve — uma inscrição nasce `pendente`, e `pendente` não entra nem define
 * palavra-passe. Quem encher isto de linhas falsas dá trabalho a quem analisa;
 * não chega a ver um pedido de um cliente.
 *
 * O QUE ESTE FICHEIRO GUARDA, agora: que a página e a rota estão ao MESMO
 * nível, e que as duas verificações que substituíram o convite continuam lá.
 */

const MIDDLEWARE = readFileSync(join(process.cwd(), "src", "middleware.ts"), "utf8");

/** O corpo de uma função do middleware, sem os comentários que a explicam. */
function corpoDe(nome: string): string {
  const i = MIDDLEWARE.indexOf(`function ${nome}(`);
  expect(i, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  const fim = MIDDLEWARE.indexOf("\n}", i);
  return MIDDLEWARE.slice(i, fim)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const ROTA = '"/api/profissionais/inscricao"';

const PAGINA = '"/profissionais/inscricao"';

describe("o portão da inscrição do profissional", () => {
  it("a rota está ABERTA — quem carrega no botão vem de uma página pública", () => {
    // Quem chega aqui vem da homepage e não tem cookie de chave nenhum. Se a
    // rota voltar a `exigeChave`, o formulário recebe um 404 sem corpo.
    expect(corpoDe("exigeChave")).not.toContain(ROTA);
    expect(corpoDe("portaAberta")).toContain(ROTA);
  });

  it("a PÁGINA está aberta ao mesmo nível da rota", () => {
    /*
     * É a regra que este ficheiro existe para guardar. Uma aberta e a outra
     * fechada — em qualquer das duas ordens — dá um formulário que se preenche
     * e não envia, ou um botão que chama uma página que não existe. Já
     * aconteceu, e custou a encontrar porque o sintoma era "Erro de rede".
     */
    expect(corpoDe("portaAberta")).toContain(PAGINA);
  });

  it("mas o LINK DO CONVITE continua fechado", () => {
    /*
     * `/profissionais/inscricao/<token>` é privado. Abrir a página sem token
     * com um `startsWith` levava os tokens todos atrás — e um endereço aberto
     * é um endereço onde se podem experimentar tokens à sorte.
     */
    const corpo = corpoDe("portaAberta");
    expect(corpo).toContain(`caminho === ${PAGINA}`);
    expect(corpo).not.toContain(`startsWith(${PAGINA}`);
  });

  it("NÃO exige sessão de testador", () => {
    // É esta linha que partia a inscrição. Se voltar, quem se candidata volta
    // a ver "Erro de rede" ao carregar no botão.
    expect(corpoDe("exigeTestador")).not.toContain(ROTA);
  });

  it("o convite continua a valer — como atalho, não como portão", () => {
    /*
     * Deixou de ser obrigatório, mas um token que venha tem de ser bom: um
     * convite gasto ou expirado NÃO pode cair em silêncio para o caminho
     * aberto, senão quem clicou num link estragado inscreve-se por outra via
     * sem perceber que o link tinha um problema.
     */
    const rota = readFileSync(
      join(process.cwd(), "src/app/api/profissionais/inscricao/route.ts"),
      "utf8",
    );
    expect(rota).toContain("convitePorTokenHash");
    expect(rota).toContain("verificarTokenDeAcesso");
    expect(rota).toMatch(/status:\s*403/);
  });

  it("o que substituiu o convite continua nos dois sítios", () => {
    /*
     * ISTO É O QUE TORNA SEGURO TER ABERTO A PORTA, e por isso é o teste que
     * mais importa aqui. Se qualquer uma destas duas verificações sair, uma
     * candidatura espontânea passa a poder entrar na conta — e aí o portão do
     * middleware tem mesmo de voltar a subir.
     */
    const entrar = readFileSync(
      join(process.cwd(), "src/app/api/profissionais/entrar/route.ts"),
      "utf8",
    );
    expect(entrar).toContain('estado !== "aprovado"');

    const senha = readFileSync(
      join(process.cwd(), "src/app/api/profissionais/definir-senha/route.ts"),
      "utf8",
    );
    expect(senha).toContain('estado !== "aprovado"');

    // E a inscrição continua a nascer pendente.
    const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    expect(db).toContain("'pendente', 1, 0");
  });
});

describe("o formulário da inscrição", () => {
  const FORM = readFileSync(
    join(process.cwd(), "src/app/profissionais/InscricaoForm.tsx"),
    "utf8",
  );

  it("não chama a resposta de erro de rede quando o servidor respondeu", () => {
    /*
     * A causa foi o portão, mas o formulário tornou-a indecifrável: qualquer
     * resposta sem JSON — um 404 do middleware, um 502 da Vercel, uma página
     * de erro do Next — saía como "Erro de rede".
     *
     * Uma mensagem que culpa a ligação de quem está do outro lado, quando o
     * servidor respondeu, manda a pessoa procurar o problema no sítio errado.
     */
    expect(FORM).toContain("respostaEmJson");
  });
});
