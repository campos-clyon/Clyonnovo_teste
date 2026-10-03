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
    // Desde 01-10-2026 a agenda também leva `gravarODia`, para gravar ao largar um arrasto.
    // Com outros nomes ao lado, se for preciso (a duração, 03-10-2026): o que
    // interessa é que é o MESMO componente e a MESMA função de gravar o dia.
    expect(AGENDA).toMatch(/import MarcarODia, \{[^}]*\bgravarODia\b[^}]*\} from "\.\/MarcarODia"/);
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
    /*
     * Era `d.getHours()` — a hora do telemóvel, que acertava em Lisboa e
     * errava fora dela. Desde 01-10-2026 o site é todo à hora de Lisboa,
     * esteja quem olha onde estiver: o campo mostra-a e lê-a como Lisboa.
     */
    expect(MARCAR).toContain("return campoEmLisboa(iso);");
    expect(MARCAR).toContain("instanteEmLisboa(quando)");
    expect(MARCAR).not.toContain("toISOString().slice(0, 16)");
    expect(MARCAR).not.toContain("new Date(quando)");
  });
});

/**
 * ⚠️ O BUG DAS 15H QUE VIRAVAM 16H — 18-09-2026.
 *
 * *«Eu troco o horário para as 15h00 e salvo, mas ele não muda realmente.»*
 *
 * Mudava — para as 16h00. O campo envia a hora do relógio sem fuso nenhum, e
 * quem a lia era o servidor da Vercel, que corre em UTC. Uma hora à frente de
 * Março a Outubro, e certo no Inverno: a pior espécie de erro, porque
 * desaparece quando alguém o vai procurar.
 */
describe("a hora que ele escreve é a hora que fica", () => {
  const MARCAR = ler("src/app/profissionais/painel/MarcarODia.tsx");
  const ROTA_AGENDA = ler("src/app/api/profissionais/agenda/route.ts");

  it("o ecrã fecha a hora num instante antes de a enviar", () => {
    // No navegador, `new Date` de um texto sem fuso usa o fuso de QUEM
    // ESCREVEU — que é o relógio que ele tem à frente.
    expect(MARCAR).toContain("d.toISOString()");
    expect(MARCAR).toContain("gravarODia(pedido.negociacaoId, quandoParaEnviar)");
  });

  /*
   * E o servidor deixou de usar `new Date` sobre o texto cru. Um telemóvel
   * com a versão antiga em cache continua a enviar o formato sem fuso, e é
   * melhor gravar a hora certa do que recusar o pedido dele.
   */
  it("e o servidor lê o que não traz fuso como hora de Lisboa", () => {
    expect(ROTA_AGENDA).toContain("instanteEmLisboa(cru)");
    expect(ROTA_AGENDA).not.toContain("const d = new Date(cru)");
  });
});

describe("mudar o dia é instantâneo, no detalhe e na agenda — 01-10-2026", () => {
  /*
   * «O site é muito lento para mudar as datas e horário; mesmo que altere,
   * ele não faz de imediato.» O ecrã esperava pela rota e pelo recarregamento
   * do painel inteiro — e no detalhe nem assim mudava, porque lia a data que
   * o cliente pediu e não a combinada.
   */
  const MARCAR = ler("src/app/profissionais/painel/MarcarODia.tsx");
  const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
  const ROTA = ler("src/app/api/profissionais/agenda/route.ts");

  it("o «Marcar» avisa com a data nova ANTES de ir à rota, e desfaz com o erro", () => {
    const antes = MARCAR.indexOf("onMudou?.(quandoParaEnviar || null);");
    const rota = MARCAR.indexOf("await gravarODia(pedido.negociacaoId, quandoParaEnviar)");
    expect(antes).toBeGreaterThan(-1);
    expect(rota).toBeGreaterThan(antes);
    expect(MARCAR).toContain("new Date(jaCombinado).toISOString() : null, r.erro);");
  });

  it("o detalhe e os dois campos da agenda ouvem-no", () => {
    expect(TRABALHOS).toContain("onMudou={setCombinadaAgora}");
    expect(AGENDA.match(/onMudou=\{\(combinada, erro\) => marcarPeloCampo\(p, combinada, erro\)\}/g)).toHaveLength(2);
    expect(AGENDA.match(/onGravado=\{\(\) => gravadoPeloCampo\(p\.negociacaoId\)\}/g)).toHaveLength(2);
  });

  it("na agenda, tudo o que se vê passa pelo dia de AGORA", () => {
    // A grelha, a lista por dias, a hora do cartão, a janela e o calendário.
    expect(AGENDA).toMatch(/p\.negociacaoId in movidos \? quandoE\(\{ \.\.\.p, dataCombinada: movidos\[p\.negociacaoId\] \}\) : quandoE\(p\)/);
    const corpo = AGENDA.slice(AGENDA.indexOf("export default function Agenda("));
    const fora = corpo.replace(/const quandoAgora[\s\S]*?: quandoE\(p\);/, "").replace(/const fica = quandoE\(/, "").replace(/const real = p \? quandoE\(p\)/, "").replace(/const local = p \? quandoE\(/, "");
    expect(fora).not.toMatch(/quandoE\(/);
    expect(AGENDA).toContain("linkGoogleCalendar(p, quandoAgora(p) as string)");
  });

  it("a rota responde logo a seguir a gravar; o histórico vai para depois", () => {
    expect(ROTA).toMatch(/import \{ NextRequest, NextResponse, after \} from "next\/server";/);
    const depois = ROTA.slice(ROTA.indexOf("after(async () => {"));
    expect(ROTA.indexOf("after(async () => {")).toBeGreaterThan(ROTA.indexOf("UPDATE negociacoes SET dataCombinada"));
    expect(depois.slice(0, depois.indexOf("});") + 3)).toContain("appendOrderHistory(");
  });
});
