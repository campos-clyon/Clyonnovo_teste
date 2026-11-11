import { instanteEmLisboa } from "./hora-de-lisboa";

/**
 * O QUE O CLIENTE VIU É O QUE SE GRAVA — 11-11-2026 (ordem do CEO com o sim do dono).
 *
 * Duas marcas, para as duas vezes em que o cliente diz «sim» a um valor numa
 * mudança com a lista de parceiros:
 *
 *   · A MARCA DA FOLHA (`marca`, no bloco `folha` das horas): um resumo do
 *     conteúdo da folha que o ecrã mostra. O «Confirmo a folha» devolve-a
 *     (`marcaDaFolha`) e o servidor só confirma se a folha gravada ainda for
 *     essa — conferido no MESMO comando que confirma. Se o parceiro a corrigiu
 *     entretanto: 409, `FOLHA_MUDOU`.
 *
 *   · A ASSINATURA DO PREÇO (`assinatura`, em cada cartão da lista): feita no
 *     servidor sobre a tarifa com que o cartão foi feito (parceiros-da-mudanca.ts).
 *     O pedido devolve-a (`assinaturasDoPreco`, por id do cartão) e, se a
 *     tarifa de agora já não for a assinada, a escolha não se grava: o cliente
 *     volta à lista (`PRECO_MUDOU`).
 *
 * TRANSIÇÃO: as apps publicadas antes de hoje não mandam nem uma nem outra.
 * Aceitam-se assim até `SEM_MARCA_ATE` (7 dias); depois, quem não a mandar
 * é mandado ver outra vez. O relógio é o de Lisboa.
 *
 * PURA (sem base, sem rede, sem módulos do servidor): os ecrãs do cliente
 * importam ficheiros que passam por aqui.
 */

/** Último instante em que se aceita um pedido sem marca nem assinatura: fim de 18-11-2026, em Lisboa. */
export const SEM_MARCA_ATE = "2026-11-18T23:59:59";

export function aindaSeAceitaSemMarca(agora: Date = new Date()): boolean {
  const limite = instanteEmLisboa(SEM_MARCA_ATE);
  return limite != null && agora.getTime() <= limite.getTime();
}

/* ── As frases ────────────────────────────────────────────────────────────── */

export const FOLHA_MUDOU = "A folha mudou — veja a nova e confirme.";
export const FOLHA_SEM_MARCA = "Veja a folha outra vez antes de confirmar.";
export const PRECO_MUDOU =
  "O preço de um dos parceiros que escolheu mudou entretanto. Veja a lista outra vez e confirme a sua escolha.";
export const LISTA_POR_VER = "A lista dos parceiros foi actualizada. Veja-a outra vez e confirme a sua escolha.";

/* ── A marca da folha ─────────────────────────────────────────────────────── */

/** O resumo (SHA-256) do texto da folha gravada, tal como está na coluna. Null sem folha. */
export function marcaDaFolha(folhaJson: string | null | undefined): string | null {
  if (typeof folhaJson !== "string" || folhaJson.length === 0) return null;
  return sha256(folhaJson).slice(0, 32);
}

/** A marca (ou a assinatura) que veio no pedido: texto curto, ou null (não veio). */
export function lerMarca(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= 128 ? v : null;
}

export type ConferenciaDaMarca = "igual" | "mudou" | "sem_marca_aceite" | "sem_marca_recusada";

/** A marca que o cliente devolveu contra a da folha gravada agora. */
export function conferirMarcaDaFolha(vista: unknown, gravada: string | null, agora: Date = new Date()): ConferenciaDaMarca {
  const m = lerMarca(vista);
  if (m == null) return aindaSeAceitaSemMarca(agora) ? "sem_marca_aceite" : "sem_marca_recusada";
  return gravada != null && m === gravada ? "igual" : "mudou";
}

/* ── SHA-256, sem módulos do servidor ─────────────────────────────────────── */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const roda = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 de um texto (UTF-8), em hexadecimal. Igual ao do servidor — o teste compara-os. */
export function sha256(texto: string): string {
  const dados = new TextEncoder().encode(texto);
  const bits = dados.length * 8;
  const tamanho = (((dados.length + 9 + 63) >> 6) << 6) >>> 0;
  const m = new Uint8Array(tamanho);
  m.set(dados);
  m[dados.length] = 0x80;
  const vista = new DataView(m.buffer);
  vista.setUint32(tamanho - 8, Math.floor(bits / 0x100000000));
  vista.setUint32(tamanho - 4, bits >>> 0);

  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let bloco = 0; bloco < tamanho; bloco += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloco + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = roda(w[i - 15], 7) ^ roda(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = roda(w[i - 2], 17) ^ roda(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = roda(e, 6) ^ roda(e, 11) ^ roda(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = roda(a, 2) ^ roda(a, 13) ^ roda(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}
