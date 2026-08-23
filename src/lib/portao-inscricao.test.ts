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
 * A inscrição deixou de ser aberta a 19-08-2026: exige convite. A rota valida
 * um token de 256 bits, guardado só em hash, com prazo e de uso único — uma
 * credencial mais forte do que a palavra-passe de um testador. Quem descobrir
 * o endereço sem convite leva 403 na mesma.
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

describe("o portão da inscrição do profissional", () => {
  it("está ao alcance de quem tem a chave", () => {
    // Se sair daqui, a rota fica SEM portão nenhum: o endereço dela é
    // `/api/profissionais/...` e não `/profissionais/...`, por isso a condição
    // genérica do `exigeChave` não a apanha.
    expect(corpoDe("exigeChave")).toContain(ROTA);
  });

  it("NÃO exige sessão de testador", () => {
    // É esta linha que partia a inscrição. Se voltar, o profissional convidado
    // volta a ver "Erro de rede" ao carregar no botão.
    expect(corpoDe("exigeTestador")).not.toContain(ROTA);
  });

  it("continua a exigir convite do lado da rota", () => {
    // Baixar o portão do middleware só é seguro porque a rota valida o convite.
    // Se esta verificação sair de lá, o portão tem de voltar a subir.
    const rota = readFileSync(
      join(process.cwd(), "src/app/api/profissionais/inscricao/route.ts"),
      "utf8",
    );
    expect(rota).toContain("convitePorTokenHash");
    expect(rota).toContain("verificarTokenDeAcesso");
    expect(rota).toMatch(/status:\s*403/);
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
