import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A agenda do profissional — os trabalhos contratados, por dia.
 *
 * Um trabalho contratado vivia numa lista por estado, sem noção de tempo: o
 * de amanhã e o do mês que vem na mesma prateleira. Quem se organiza mal
 * falta, e quem falta queima a confiança que a plataforma vende.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const AGENDA = ler("src/app/profissionais/painel/Agenda.tsx");
const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
const API = ler("src/app/api/profissionais/meus-pedidos/route.ts");
const DB = ler("src/lib/db.ts");

describe("a data chega ao profissional", () => {
  it("a consulta traz a dataAgendada do pedido", () => {
    // A consulta inteira, e não os primeiros N caracteres dela: contar
    // caracteres partia-se assim que a consulta ganhasse um comentário.
    const inicio = DB.indexOf("export async function negociacoesDoProfissional");
    const q = DB.slice(inicio, DB.indexOf("WHERE n.providerId = ?", inicio));
    expect(q).toContain("o.dataAgendada");
  });

  it("a API devolve-a em qualquer estado", () => {
    // A data não é contacto: ajuda a decidir ANTES de aceitar, e é a espinha
    // da agenda depois de contratar.
    expect(API).toContain("dataAgendada:");
  });
});

describe("o ecrã", () => {
  it("só agenda o que está contratado e por fazer", () => {
    // O confirmado já foi; o em-negociação ainda não é de ninguém.
    expect(AGENDA).toContain('p.fase === "a_executar" && !p.arquivadoEm');
  });

  it("um trabalho sem data não inventa uma", () => {
    expect(AGENDA).toContain("Sem data marcada");
    expect(AGENDA).toContain("combine com o cliente");
  });

  it("o botão cria o evento no calendário do telemóvel, com o fuso certo", () => {
    /*
     * Não se reinventou o Google Calendar: o calendário que o profissional
     * já olha é o do telemóvel, e são os lembretes NATIVOS que impedem a
     * falta. Horas flutuantes + ctz: o trabalho é às 9h em Lisboa, esteja o
     * telemóvel configurado como estiver.
     */
    expect(AGENDA).toContain("calendar.google.com/calendar/render");
    expect(AGENDA).toContain('ctz: "Europe/Lisbon"');
  });

  it("está no menu do painel, com a contagem dos marcados", () => {
    expect(PAINEL).toContain('rotulo="Agenda"');
    expect(PAINEL).toContain("marcado");
    expect(PAINEL).toContain('{ecra === "agenda" && (');
  });
});

/**
 * EDITAR A AGENDA A PARTIR DA AGENDA — 18-09-2026.
 *
 * *«Os profissionais devem ter a opção de editar as suas agendas para ajustar
 * as datas e horários dos trabalhos.»*
 *
 * Já podiam — mas só dentro do cartão do trabalho, noutro ecrã. Na agenda viam
 * que estava errado e tinham de sair dali para o corrigir. É a mesma lição que
 * o botão de arquivar já tinha ensinado: ninguém sai da agenda para ir arrumar
 * a agenda.
 */
describe("o dia muda-se de dentro da agenda", () => {
  const MARCAR = ler("src/app/profissionais/painel/MarcarODia.tsx");
  const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");

  it("a agenda monta o mesmo componente que a ficha do trabalho", () => {
    expect(AGENDA).toContain('import MarcarODia from "./MarcarODia"');
    expect(TRABALHOS).toContain('import MarcarODia from "./MarcarODia"');
  });

  /*
   * UM SÓ SÍTIO A GRAVAR. Duas cópias do formulário acabavam com duas regras
   * de data — e a que ficasse para trás gravava por cima do que o cliente
   * pediu, que é precisamente o que a rota existe para impedir.
   */
  it("e só ele fala com a rota", () => {
    expect(MARCAR).toContain('fetch("/api/profissionais/agenda"');
    expect(TRABALHOS).not.toContain('fetch("/api/profissionais/agenda"');
  });

  it("sem data, o campo já está aberto — é o que a secção pede", () => {
    expect(AGENDA).toContain("Sem data marcada — combine com o cliente e marque aqui.");
    // A frase antiga mandava esperar pela CLYON, e deixou de ser verdade.
    expect(AGENDA).not.toContain("a CLYON regista-a no pedido");
  });

  it("com data, abre-se um de cada vez", () => {
    // Oito campos de data abertos ao mesmo tempo não é uma agenda: é um
    // formulário. E o gesto principal deste ecrã é ligar ao cliente.
    expect(AGENDA).toContain("aMudar === p.negociacaoId");
    expect(AGENDA).toContain("Mudar o dia ou a hora");
  });

  /*
   * O campo diz a hora LOCAL e a data vem em ISO com Z. Sem esta conversão, um
   * trabalho das 11h aparecia às 10h — e bastava gravar para o adiantar.
   */
  it("o campo não anda uma hora para trás", () => {
    expect(MARCAR).toContain("d.getHours()");
    expect(MARCAR).not.toContain("toISOString().slice(0, 16)");
  });
});
