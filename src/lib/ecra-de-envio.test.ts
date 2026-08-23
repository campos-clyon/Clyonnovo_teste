import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Os dois ecrãs do fim do simulador: o do envio e o do link que já não abre.
 *
 * Nenhum destes testes prova que o ecrã fica bonito. Provam que três decisões
 * não voltam atrás sem alguém dar por isso — e as três já cá estiveram.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const FORM = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
/*
 * Sem os comentários.
 *
 * Os testes de voz têm de olhar para o que o ecrã DIZ, e um comentário que
 * cita a frase velha para explicar porque saiu não é o ecrã a dizê-la — era
 * o próprio registo do porquê a fazer o teste falhar.
 */
const FORM_SEM_NOTAS = FORM.replace(/\/\*[\s\S]*?\*\//g, "");
const PEDIDO = ler("src/app/pedido/[token]/page.tsx");

describe("o ecrã de envio", () => {
  it("não volta a segurar o cliente por tempo inventado", () => {
    /*
     * Havia um `setTimeout(20000)` chamado `minWait`, com o comentário
     * "momento de análise antes do sucesso". O trabalho real acabava muito
     * antes; os 20 segundos eram encenação — e eram a maior parte do minuto
     * que o cliente esperava.
     *
     * Fica um chão de 2,2s, que é outra coisa: serve para o ecrã não piscar
     * quando o trabalho acaba em 300ms, não para encher tempo.
     */
    const esperas = [...FORM.matchAll(/setTimeout\(resolve,\s*(\d+)\)/g)].map((m) => Number(m[1]));
    expect(esperas.length, "esperava um único chão de tempo no envio").toBe(1);
    expect(esperas[0]).toBeLessThanOrEqual(3000);
  });

  it("mostra os passos a sério, e não uma contagem regressiva", () => {
    expect(FORM).toContain("PASSOS_DO_ENVIO");
    // O contador de fotos é o único sítio do envio onde há mesmo progresso
    // para mostrar: elas sobem uma de cada vez.
    expect(FORM).toContain("setFotosFeitas");
    expect(FORM, "a contagem regressiva falsa voltou").not.toContain("setCountdown");
  });

  it("esconde o passo das fotografias quando não há fotografias", () => {
    // Sem isto, o passo levava visto verde por um trabalho que nunca houve.
    expect(FORM).toContain("passosVisiveis");
  });
});

describe("o ecrã de sucesso", () => {
  it("não diz que a CLYON avalia o pedido nem que telefona", () => {
    /*
     * Dizia "A equipa CLYON vai avaliar o pedido em breve e entrar em contacto
     * por telefone ou email". A CLYON não avalia nem executa: quem responde
     * são os profissionais, e o que chega são propostas.
     */
    expect(FORM_SEM_NOTAS).not.toContain("A equipa CLYON vai avaliar");
    expect(FORM_SEM_NOTAS).not.toMatch(/equipa vai avaliar o pedido/);
  });

  it("não acaba num beco", () => {
    // Acabava num botão "Novo pedido" e mais nada — no instante de maior
    // intenção da visita inteira.
    expect(FORM).toMatch(/href="\/entrar"|href="\/conta"/);
  });
});

describe("o link do pedido que já não abre", () => {
  it("deixou de dar o 404 genérico do site", () => {
    /*
     * Dava "A página que procura não existe ou foi movida" — a quem tem o
     * email aberto ao lado com o link lá dentro, mandado por nós. E o 404 do
     * site não tem contacto de apoio nenhum.
     *
     * Vai passar a ser comum: os pedidos são apagados aos 60 dias.
     */
    expect(PEDIDO, "o notFound() voltou").not.toContain("notFound()");
  });

  it("dá caminho para o apoio", () => {
    expect(PEDIDO).toContain("wa.me/");
    expect(PEDIDO).toContain('href="/contactos"');
  });

  it("mostra o mesmo a quem adivinha tokens e a quem tinha um pedido apagado", () => {
    /*
     * Os dois casos partilham o MESMO ramo. Se se separassem, quem fosse
     * tentando à sorte ficava a saber quais dos palpites acertaram num pedido
     * real — um oráculo dado de graça.
     */
    expect(PEDIDO).toContain(
      'if (!pedido || (!resultado.valido && resultado.motivo !== "expirado"))',
    );
  });

  it("continua a distinguir o link expirado, que já provou ser válido", () => {
    expect(PEDIDO).toContain("Este link expirou");
  });
});
