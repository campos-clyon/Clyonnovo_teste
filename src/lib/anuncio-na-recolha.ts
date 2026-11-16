import { anuncioNosTextos, fraseDoAnuncio, PERGUNTA_DO_ANUNCIO } from "./anuncio-de-imovel";
import { perguntaDo, type DadosDaRecolha, type EstadoDaRecolha, type RespostaDaRecolha } from "./whatsapp-recolha";

/*
 * O ANÚNCIO NA RECOLHA DO WHATSAPP — 16-11-2026 (decisão d48).
 *
 * Ele mandou o link do anúncio da casa: o que o endereço diz (ver
 * `anuncio-de-imovel.ts`) entra na recolha uma vez — a zona (o concelho)
 * quando ainda não há nenhuma, o andar quando ainda não se sabe — e, numa
 * recolha de móveis ou de monos, a pergunta seguinte dá lugar a uma só:
 *
 *   «Pelo anúncio, é um T3 na Mina de Água (Amadora). É para esvaziar a
 *   casa toda ou só alguns móveis?»
 *
 * A resposta lê-se como a do «parece um esvaziamento» (é a mesma pergunta,
 * `aConfirmarEsvaziamento`): a casa toda passa a esvaziamento de casa; só
 * alguns móveis fica recolha. Numa mudança, a casa do anúncio pode ser a de
 * destino: guarda-se o anúncio e não se mexe na zona.
 *
 * Puro: chama-o `recolherPedidoPorWhatsApp`, e os testes.
 */

const SERVICOS_DA_PERGUNTA: ReadonlySet<string> = new Set(["recolha_moveis", "recolha_monos"]);

/** Antes de ler a mensagem: o que o link diz, no que ainda está vazio. */
export function comOAnuncio(estado: EstadoDaRecolha, textos: readonly string[]): EstadoDaRecolha {
  const d0 = estado.dados;
  const anuncio = d0.anuncio ?? (d0.anuncioLido ? null : anuncioNosTextos(textos));
  if (!anuncio) return estado;
  const d: DadosDaRecolha = { ...d0, anuncio, anuncioLido: true };
  if (d.serviceType && d.serviceType !== "mudanca" && d.pedidoAberto == null) {
    if (!d.city && !d.postalCode && !d.address && (anuncio.concelho || anuncio.localidade)) {
      d.city = anuncio.concelho ?? anuncio.localidade;
    }
    if (d.floor == null && anuncio.andar != null && !anuncio.moradia) d.floor = anuncio.andar;
  }
  return JSON.stringify(d) === JSON.stringify(d0) ? estado : { passo: estado.passo, dados: d };
}

/** A pergunta do anúncio, no lugar da pergunta seguinte — uma vez, e só numa recolha de móveis ou de monos. */
export function perguntarPeloAnuncio(r: RespostaDaRecolha, agora: Date): RespostaDaRecolha {
  const d = r.estado.dados;
  if (!d.anuncio || r.registar || r.pedirPessoa || r.desistir || r.foraDoPlano || r.respondidaAntes || !r.resposta) return r;
  if (d.esvaziamentoPerguntado || d.aConfirmarEsvaziamento || d.pedidoAberto != null) return r;
  if (!d.serviceType || !SERVICOS_DA_PERGUNTA.has(d.serviceType)) return r;
  if (r.estado.passo === "servico" || r.estado.passo === "confirmar") return r;
  const pergunta = [perguntaDo(r.estado.passo, d, false, agora), perguntaDo(r.estado.passo, d, true, agora)].find((p) =>
    r.resposta.trimEnd().endsWith(p),
  );
  if (!pergunta) return r;
  const antes = r.resposta.trimEnd().slice(0, -pergunta.length);
  return {
    ...r,
    estado: {
      passo: r.estado.passo,
      dados: { ...d, aConfirmarEsvaziamento: "esvaziamento_casa", esvaziamentoPerguntado: true },
    },
    resposta: `${antes}${fraseDoAnuncio(d.anuncio)} ${PERGUNTA_DO_ANUNCIO}`,
  };
}
