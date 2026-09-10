import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ARQUIVAR NA AGENDA DO PROFISSIONAL.
 *
 * "Os pros estão a reclamar de terem a agenda cheia; os trabalhos em que o
 * cliente deixou de responder não saem da agenda." — 10-09-2026.
 *
 * A agenda mostra o que está contratado e por fazer, e um trabalho contratado
 * só sai de lá quando alguém o dá por feito. É precisamente isso que não
 * acontece quando o cliente desaparece: o trabalho fica ali para sempre, a
 * empurrar para baixo o que ainda interessa.
 *
 * Arquivar já resolvia — a agenda sempre escondeu os arquivados — mas o botão
 * só existia em «Os meus trabalhos». Ninguém sai da agenda para ir arrumar a
 * agenda.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const AGENDA = ler("src/app/profissionais/painel/Agenda.tsx");
const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
const ARRUMAR = ler("src/app/profissionais/painel/arrumar.ts");
const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");

describe("a regra de arrumar vive num sítio só", () => {
  it("os dois ecrãs leem a MESMA função, e não uma cópia", () => {
    /*
     * Duas cópias divergem à primeira alteração, e a que ficasse para trás
     * deixava de desistir antes de esconder — que é a parte que protege o
     * cliente de ficar à espera de quem já arrumou o pedido.
     */
    expect(ARRUMAR).toContain("export async function arrumarTrabalho(");
    expect(ARRUMAR).toContain("export function confirmarArrumacao(");
    expect(AGENDA).toContain('from "./arrumar"');
    expect(TRABALHOS).toContain('from "./arrumar"');
    // E já não há uma segunda definição no ecrã dos trabalhos.
    expect(TRABALHOS).not.toContain("async function arrumarTrabalho(");
    expect(TRABALHOS).not.toContain("function confirmarArrumacao(");
  });

  it("um pedido ainda aberto DESISTE antes de ser escondido", () => {
    // Sem isto ficava uma negociação-fantasma: o cliente a ver "à espera de
    // resposta" de alguém que já arrumou o pedido e nunca mais o vai ver.
    const corpo = ARRUMAR.slice(ARRUMAR.indexOf("export async function arrumarTrabalho("));
    expect(corpo).toContain('accao: "desistir"');
    expect(corpo).toContain("if (!desistiu.ok) return false;");
    expect(corpo.indexOf('accao: "desistir"')).toBeLessThan(
      corpo.indexOf("/api/profissionais/arquivar"),
    );
  });

  it("um contratado avisa que continua combinado com o cliente", () => {
    /*
     * Arquivar tira-o da vista e da agenda — não desmarca nada. Quem carrega
     * a pensar que cancelou faltava ao trabalho.
     */
    expect(ARRUMAR).toContain("Este trabalho está contratado.");
    expect(ARRUMAR).toContain("continua combinado com o cliente");
  });
});

describe("a agenda ganhou o botão", () => {
  it("arquiva sem sair da agenda, e recarrega a lista", () => {
    expect(AGENDA).toContain("Arquivar — o cliente não responde");
    expect(AGENDA).toContain("confirmarArrumacao(p)");
    expect(AGENDA).toContain("arrumarTrabalho(p, true)");
    expect(AGENDA).toContain("onRecarregar()");
  });

  it("o painel liga o recarregar — senão o cartão ficava lá até um F5", () => {
    const i = PAINEL.indexOf("<Agenda");
    expect(PAINEL.slice(i, PAINEL.indexOf("/>", i))).toContain("onRecarregar={carregar}");
  });

  it("não compete com o telefone, que é o gesto principal do ecrã", () => {
    // A agenda existe para ele ligar ao cliente; arquivar é a saída para
    // quando já ligou e não há ninguém do outro lado.
    const i = AGENDA.indexOf("Arquivar — o cliente não responde");
    const bloco = AGENDA.slice(AGENDA.lastIndexOf("<button", i), i);
    expect(bloco).toContain("text-tinta-fraca");
    expect(bloco).not.toContain("bg-acao");
  });

  it("e a agenda continua a esconder o que foi arquivado", () => {
    // É esta linha que faz o botão valer alguma coisa.
    expect(AGENDA).toContain('p.fase === "a_executar" && !p.arquivadoEm');
  });
});
