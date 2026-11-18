import { conferirComprovativo, type ComprovativoConferido } from "./comprovativo-do-pagamento";
import { guardarComprovativo, subirComprovativo } from "./rasto-do-pagamento-na-base";
import type { AlvoDoComprovativo } from "./origem-do-pagamento";

/**
 * O FICHEIRO DO COMPROVATIVO QUE VEM NUM FORMULÁRIO — d66. Lê o campo `file`,
 * confere-o (tipo, tamanho, primeiros bytes) e diz o que falhou. Sem ficheiro
 * nenhum, `null`: quem chama decide se era obrigatório.
 */
export async function ficheiroDoComprovativo(
  fd: FormData,
): Promise<null | { ok: true; ficheiro: File; conferido: Extract<ComprovativoConferido, { ok: true }> } | { ok: false; erro: string; status: number }> {
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return null;
  const primeiros = new Uint8Array(await f.slice(0, 16).arrayBuffer());
  const c = conferirComprovativo({ nome: f.name, tipoDeclarado: f.type, tamanho: f.size, primeirosBytes: primeiros });
  if (!c.ok) return { ok: false, erro: c.erro, status: c.status };
  return { ok: true, ficheiro: f, conferido: c };
}

/** Sobe e grava (um ficheiro, um ou mais registos do mesmo trabalho). */
export async function juntarComprovativo(d: {
  ficheiro: File;
  conferido: Extract<ComprovativoConferido, { ok: true }>;
  alvo: AlvoDoComprovativo;
  alvoIds: number[];
  negociacaoId: number | null;
  pedidoId: number | null;
  por: string;
}): Promise<number[]> {
  const caminho = `comprovativos/${d.pedidoId ?? 0}-${d.negociacaoId ?? 0}-${d.alvo}-${d.alvoIds[0] ?? 0}`;
  const url = await subirComprovativo(d.ficheiro, d.conferido, caminho);
  return guardarComprovativo({
    alvo: d.alvo,
    alvoIds: d.alvoIds,
    negociacaoId: d.negociacaoId,
    pedidoId: d.pedidoId,
    url,
    nome: d.conferido.nome,
    tipo: d.conferido.tipo,
    tamanho: d.ficheiro.size,
    por: d.por,
  });
}
