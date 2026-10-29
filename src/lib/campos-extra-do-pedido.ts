/**
 * OS CAMPOS DO SIMULADOR QUE A MESA AINDA NÃO MOSTRAVA — 29-10-2026 (S14).
 *
 * O pedido guarda o formulário inteiro em `rawOrderJson`, mas a Mesa só lia
 * parte dele: a quantidade exacta, os sacos do entulho, a desmontagem, as
 * notas do acesso, a repetição e a autorização das fotografias ficavam
 * escondidos — vindos do site ou da app de cliente, que manda os mesmos
 * campos. Puro: a Mesa usa-o no browser.
 */
export type CampoExtra = { rotulo: string; valor: string };

const sim = (v: unknown) => v === true || v === "yes" || v === "sim";
const nao = (v: unknown) => v === false || v === "no" || v === "nao" || v === "não";
const texto = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
};

export function camposExtraDoPedido(
  raw: Record<string, unknown> | null | undefined,
  /** Os pormenores que o cliente juntou depois de enviar (S17): texto dele, à parte da descrição. */
  pormenoresDoCliente?: string | null,
): CampoExtra[] {
  const saida: CampoExtra[] = [];
  try {
    const l = JSON.parse(pormenoresDoCliente ?? "[]");
    if (Array.isArray(l)) {
      l.forEach((p: { texto?: unknown }, i: number) => {
        if (typeof p?.texto === "string" && p.texto.trim()) {
          saida.push({ rotulo: l.length > 1 ? `Pormenores do cliente (${i + 1})` : "Pormenores do cliente", valor: p.texto.trim() });
        }
      });
    }
  } catch {
    /* ilegível: fica de fora */
  }
  if (!raw || typeof raw !== "object") return saida;
  const r = raw as Record<string, unknown>;
  const por = (rotulo: string, valor: string | null) => {
    if (valor) saida.push({ rotulo, valor });
  };

  if (r.origemPedido === "app_cliente") por("Origem", "App de cliente");
  por("Quantidade exacta", numero(r.quantityExact) ?? texto(r.quantityExact, 60));
  por("Sacos já cheios", numero(r.entulhoQuantidadeEnsacados));
  por("Sacos por encher", numero(r.entulhoQuantidadePorEnsacar));
  if (r.entulhoQuantidadeIncerta === true) por("Quantidade do entulho", "O cliente não tem a certeza");
  if (sim(r.needsDismantling)) por("Desmontagem", "Sim, é preciso desmontar");
  else if (nao(r.needsDismantling)) por("Desmontagem", "Não");
  por("Notas do acesso", texto(r.accessNotes));
  const origem = (r.originAccess ?? {}) as Record<string, unknown>;
  const destino = (r.destinationAccess ?? {}) as Record<string, unknown>;
  por("Notas do acesso (origem)", texto(origem.accessNotes));
  por("Notas do acesso (destino)", texto(destino.accessNotes));
  if (r.recurrenceFrequency === "semanal") por("Repetição", "Semanal");
  if (r.recurrenceFrequency === "quinzenal") por("Repetição", "Quinzenal");
  if (r.autorizaFotos === true) por("Fotografias", "Autoriza mostrá-las no site e nas redes, sem nada que o identifique");
  return saida;
}
