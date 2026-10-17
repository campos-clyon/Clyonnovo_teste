/**
 * QUANTOS CLIENTES PEDIRAM — 17-10-2026.
 *
 * *«50 contas me parece pouco para um ano de site, devemos estar a fazer algo
 * errado.»* — o dono, que escolheu «contar os clientes a sério». Conta não é
 * cliente: ninguém precisa de conta para pedir. O painel dizia «51 pediram
 * sem criar conta», e contava só quem deixou EMAIL — quem pediu só com o
 * telefone, ou pelo WhatsApp, não entrava em lado nenhum.
 *
 * Aqui uma pessoa é um email OU um telefone: dois pedidos com o mesmo email,
 * ou com o mesmo telemóvel, são a mesma pessoa — e se um tiver os dois, junta
 * os outros. Puro, para se testar.
 *
 * Conta os pedidos que estão na base. A purga apaga-os ao fim de 60 dias
 * (fechados) ou 90 (abandonados) — quem pediu antes disso já não está aqui, e
 * o painel di-lo.
 */

export type PedidoParaContar = {
  id: number;
  email: string | null;
  telefone: string | null;
  criadoEm: Date | string | null;
};

export type ClientesDosPedidos = {
  /** Pedidos na base agora. */
  pedidos: number;
  /** Pessoas distintas nesses pedidos. */
  clientes: number;
  /** Dessas, as que têm conta CLYON (pelo email). */
  comConta: number;
  /** Dessas, as que nunca deixaram email. */
  soTelefone: number;
  /** O pedido mais antigo ainda na base, em ISO — a janela desta contagem. */
  desde: string | null;
};

/** O email, em minúsculas — ou nada, se não parecer um email. */
export function emailDoCliente(v: string | null | undefined): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/** Os últimos 9 algarismos do telefone: «+351 912 345 678» e «912345678» são o mesmo. */
export function telefoneDoCliente(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : null;
}

export function clientesDosPedidos(pedidos: PedidoParaContar[], emailsComConta: Iterable<string>): ClientesDosPedidos {
  const contas = new Set([...emailsComConta].map((e) => e.trim().toLowerCase()));
  // Uma floresta: cada chave («e:…» ou «t:…») aponta para a sua raiz.
  const pai = new Map<string, string>();
  const raiz = (k: string): string => {
    let r = k;
    while (pai.get(r) !== r) r = pai.get(r)!;
    // Encurtar o caminho, para a próxima ser directa.
    let x = k;
    while (pai.get(x) !== r) {
      const seguinte = pai.get(x)!;
      pai.set(x, r);
      x = seguinte;
    }
    return r;
  };
  const juntar = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) pai.set(rb, ra);
  };

  let desde: number | null = null;
  for (const p of pedidos) {
    const chaves = [emailDoCliente(p.email), telefoneDoCliente(p.telefone)]
      .map((v, i) => (v ? `${i === 0 ? "e" : "t"}:${v}` : null))
      .filter((k): k is string => k != null);
    for (const k of chaves) if (!pai.has(k)) pai.set(k, k);
    if (chaves.length === 2) juntar(chaves[0], chaves[1]);
    const t = p.criadoEm ? new Date(p.criadoEm).getTime() : NaN;
    if (Number.isFinite(t) && (desde == null || t < desde)) desde = t;
  }

  const grupos = new Map<string, string[]>();
  for (const k of pai.keys()) {
    const r = raiz(k);
    grupos.set(r, [...(grupos.get(r) ?? []), k]);
  }
  let comConta = 0;
  let soTelefone = 0;
  for (const chaves of grupos.values()) {
    const emails = chaves.filter((k) => k.startsWith("e:")).map((k) => k.slice(2));
    if (emails.length === 0) soTelefone += 1;
    if (emails.some((e) => contas.has(e))) comConta += 1;
  }

  return {
    pedidos: pedidos.length,
    clientes: grupos.size,
    comConta,
    soTelefone,
    desde: desde != null ? new Date(desde).toISOString() : null,
  };
}
