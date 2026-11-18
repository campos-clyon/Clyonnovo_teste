import { tipoDoFicheiro } from "./tipo-ficheiro";

/**
 * O COMPROVATIVO DE UM PAGAMENTO REGISTADO À MÃO — d66 (18-11-2026).
 *
 * Uma fotografia (imagem) ou um PDF: o talão do multibanco, a captura do
 * homebanking, a fotografia do recibo do numerário. Até 10 MB. Só a equipa os
 * vê: guardam-se no armazenamento privado das faturas, e lêem-se pela rota
 * autenticada (`/api/admin/pagamentos/rasto/comprovativo/<id>`) — o endereço
 * do armazenamento nunca sai do servidor.
 *
 * Puro: o tipo pelo que o browser declara (ou pela extensão) E pelos
 * primeiros bytes do ficheiro — um «.pdf» que não começa por `%PDF` não é um
 * PDF.
 */

export const TAMANHO_MAXIMO_DO_COMPROVATIVO = 10 * 1024 * 1024;

export const TIPOS_DO_COMPROVATIVO = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** O que o `<input type="file">` oferece. */
export const ACEITA_O_COMPROVATIVO = "image/*,application/pdf";

export const MENSAGENS_DO_COMPROVATIVO = {
  semFicheiro: "Junte o comprovativo (fotografia ou PDF).",
  grande: "O comprovativo passa de 10 MB.",
  tipo: "O comprovativo é uma fotografia (JPG, PNG, WEBP, HEIC) ou um PDF.",
  falhou: "Não foi possível guardar o comprovativo. Tente outra vez.",
} as const;

/** Os primeiros bytes batem com o tipo? (HEIC: a caixa `ftyp` no 4.º byte.) */
export function bytesBatemComOTipo(tipo: string, b: Uint8Array): boolean {
  const comeca = (...xs: number[]) => xs.every((x, i) => b[i] === x);
  switch (tipo) {
    case "application/pdf":
      return comeca(0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/jpeg":
      return comeca(0xff, 0xd8, 0xff);
    case "image/png":
      return comeca(0x89, 0x50, 0x4e, 0x47);
    case "image/webp":
      return comeca(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    case "image/heic":
    case "image/heif":
      return b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70; // ftyp
    default:
      return false;
  }
}

export type ComprovativoConferido =
  | { ok: true; tipo: (typeof TIPOS_DO_COMPROVATIVO)[number]; extensao: string; nome: string }
  | { ok: false; erro: string; status: 400 | 413 | 415 };

/** Confere um ficheiro antes de subir: existe, até 10 MB, imagem ou PDF de verdade. */
export function conferirComprovativo(f: {
  nome: string;
  tipoDeclarado: string | null | undefined;
  tamanho: number;
  primeirosBytes: Uint8Array;
}): ComprovativoConferido {
  if (!(f.tamanho > 0)) return { ok: false, erro: MENSAGENS_DO_COMPROVATIVO.semFicheiro, status: 400 };
  if (f.tamanho > TAMANHO_MAXIMO_DO_COMPROVATIVO) return { ok: false, erro: MENSAGENS_DO_COMPROVATIVO.grande, status: 413 };
  const v = tipoDoFicheiro(f.nome, f.tipoDeclarado);
  const tipo = v.ok ? (v.tipo === "image/jpg" ? "image/jpeg" : v.tipo) : null;
  if (!tipo || !(TIPOS_DO_COMPROVATIVO as readonly string[]).includes(tipo) || !bytesBatemComOTipo(tipo, f.primeirosBytes)) {
    return { ok: false, erro: MENSAGENS_DO_COMPROVATIVO.tipo, status: 415 };
  }
  const extensao = tipo === "application/pdf" ? "pdf" : tipo === "image/jpeg" ? "jpg" : tipo.split("/")[1];
  const nome = f.nome.replace(/[^\w.\- ]/g, "_").slice(-120) || `comprovativo.${extensao}`;
  return { ok: true, tipo: tipo as (typeof TIPOS_DO_COMPROVATIVO)[number], extensao, nome };
}
