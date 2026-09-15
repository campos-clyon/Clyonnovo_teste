import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O QUE ENTRA PELA PONTE FICA REGISTADO — decida-se o que se decidir a seguir.
 *
 * "Esse pedido nunca apareceu aqui no assistente." — 15-09-2026, sobre a
 * conversa do Hugo Silva (+351 913 466 982): um vídeo da casa, a morada em Mem
 * Martins, o 5.º andar com elevador, e 350 € combinados — tudo no WhatsApp, e
 * nem uma linha no painel.
 *
 * Havia DOIS caminhos nesta rota que voltavam para trás sem escrever nada: o
 * aviso de que o dono respondeu à mão, e o site desligado.
 *
 * É a mesma avaria que já tinha sido corrigida a 10-09 para as conversas
 * entregues a uma pessoa — nessa altura uma cliente escreveu três mensagens
 * seguidas sobre um frigorífico e nenhuma apareceu no ecrã. A lição ficou
 * escrita no próprio ficheiro: CALAR O ASSISTENTE E NÃO GUARDAR A CONVERSA SÃO
 * DUAS DECISÕES DIFERENTES, e só a primeira foi pedida. Faltava aplicá-la aos
 * outros dois caminhos.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PONTE = ler("src/app/api/whatsapp/ponte/route.ts");

/** O corpo do POST, que é onde as decisões se tomam. */
const POST = PONTE.slice(PONTE.indexOf("export async function POST"));

describe("os quatro caminhos, e o que cada um guarda", () => {
  it("há UM sítio a guardar, e não quatro cópias", () => {
    // Quatro cópias de «registar o que entrou» acabam com três a fazer o mesmo
    // e uma esquecida — que foi exactamente como isto aconteceu.
    expect(POST).toContain("async function guardarOQueEntrou()");
    expect(POST.match(/guardarOQueEntrou\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("o dono respondeu à mão: cala o assistente E guarda a mensagem", () => {
    const i = POST.indexOf('corpo.accao === "interromper"');
    const bloco = POST.slice(i, i + 400);
    expect(bloco).toContain("guardarOQueEntrou()");
    expect(bloco).toContain("interromperNumeroWhatsApp");
  });

  it("site desligado: não responde, mas guarda", () => {
    /*
     * Ligar outra vez e encontrar a caixa vazia era perder tudo o que os
     * clientes escreveram enquanto esteve desligado.
     */
    const i = POST.indexOf("if (!(await whatsappLigado()))");
    expect(i).toBeGreaterThan(-1);
    expect(POST.slice(i, i + 500)).toContain("guardarOQueEntrou()");
  });

  it("conversa entregue a uma pessoa: continua a guardar", () => {
    // Já era assim desde 10-09, e continua.
    const i = POST.indexOf("numeroInterrompidoWhatsApp(telefone)");
    expect(POST.slice(i, i + 500)).toContain("registarMensagemWhatsApp");
  });

  it("BLOQUEADO é a única excepção — e é de propósito", () => {
    /*
     * Bloquear existe para os contactos pessoais e para quem o dono decidiu
     * que o assunto não é com o site. Guardar-lhes as mensagens era o
     * contrário de bloquear.
     */
    const i = POST.indexOf("if (await numeroBloqueadoWhatsApp(telefone))");
    expect(i).toBeGreaterThan(-1);
    const bloco = POST.slice(i, i + 300);
    expect(bloco).not.toContain("guardarOQueEntrou()");
  });

  it("o bloqueado é decidido SEPARADAMENTE do desligado", () => {
    /*
     * Estavam no mesmo `if`, com um «ou» pelo meio — e por isso partilhavam a
     * decisão de não guardar nada. São duas coisas diferentes: uma é «este
     * número não é cliente», a outra é «hoje o assistente está calado».
     */
    expect(POST).not.toContain("!(await whatsappLigado()) || (await numeroBloqueadoWhatsApp");
  });
});

describe("guardar nunca pode travar a ponte", () => {
  it("o erro é apanhado e escrito, e a resposta segue", () => {
    /*
     * A ponte fica à espera para saber de quem é a conversa. Um erro a gravar
     * calava-a — e aí perdia-se a mensagem E a resposta.
     */
    const i = POST.indexOf("async function guardarOQueEntrou()");
    const corpo = POST.slice(i, i + 700);
    expect(corpo).toContain("catch");
    expect(corpo).toContain("[ponte] nao registei a mensagem");
  });

  it("guarda a fotografia e o texto — a legenda não se perde", () => {
    const i = POST.indexOf("async function guardarOQueEntrou()");
    const corpo = POST.slice(i, i + 700);
    expect(corpo).toContain("[fotografia]");
    expect(corpo).toContain("texto.trim()");
  });
});
