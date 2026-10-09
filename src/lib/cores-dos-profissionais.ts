/**
 * UMA COR POR PROFISSIONAL NOS PAGAMENTOS — 09-10-2026.
 *
 * *«Vc deve separar com cores diferentes e deixar os nomes das empresas
 * destacados.»* O grupo de cada profissional era um nome em cinzento-claro
 * sobre uma linha fina, e três empresas seguidas liam-se como uma lista só.
 *
 * Os tons são os da paleta do dono (o `@theme` do globals.css), escritos por
 * inteiro para o Tailwind os encontrar. Três ficam de fora da roda: o âmbar e
 * o esmeralda, que neste ecrã já querem dizer «por receber» e «pago» (uma
 * «Nova Recolha:» em âmbar lia-se como dinheiro em falta), e a ardósia, que é
 * o cinzento do resto do ecrã e a cor das contas de teste.
 *
 * A cor reparte-se pela ordem alfabética dos profissionais que estão no ecrã —
 * a mesma ordem dos grupos. Dois grupos seguidos têm cores diferentes (até
 * sete profissionais), e o mesmo profissional tem a mesma cor em todos os
 * blocos da página: «Feitos» e «Ainda por fazer».
 *
 * Nos Levantamentos é a mesma conta. Nas Carteiras (também 09-10-2026) os
 * cartões vêm por quanto há a pagar, e não pelo nome: aí a cor reparte-se
 * pela ordem em que aparecem (`coresPelaOrdem`), para dois cartões seguidos
 * nunca terem a mesma.
 */

export type CorDoProfissional = {
  /** O grupo dele: contorno, faixa grossa à esquerda e fundo. */
  grupo: string;
  /** O nome da empresa. */
  nome: string;
  /** A faixa à esquerda de cada linha dele, também quando se agrupa por dia. */
  linha: string;
};

export const CORES_DOS_PROFISSIONAIS: readonly CorDoProfissional[] = [
  { grupo: "border-ciano/40 border-l-ciano bg-ciano/14", nome: "text-ciano-texto", linha: "border-l-ciano" },
  { grupo: "border-violeta/40 border-l-violeta bg-violeta/14", nome: "text-violeta-texto", linha: "border-l-violeta" },
  { grupo: "border-laranja/40 border-l-laranja bg-laranja/14", nome: "text-laranja-texto", linha: "border-l-laranja" },
  { grupo: "border-azul/40 border-l-azul bg-azul/14", nome: "text-azul-texto", linha: "border-l-azul" },
  { grupo: "border-magenta/40 border-l-magenta bg-magenta/14", nome: "text-magenta-texto", linha: "border-l-magenta" },
  { grupo: "border-lima/40 border-l-lima bg-lima/14", nome: "text-lima-texto", linha: "border-l-lima" },
  { grupo: "border-coral/40 border-l-coral bg-coral/14", nome: "text-coral-texto", linha: "border-l-coral" },
];

/** As contas de teste: cinzentas, para não se confundirem com quem se paga a sério. */
export const COR_DA_CONTA_DE_TESTE: CorDoProfissional = {
  grupo: "border-ardosia/40 border-l-ardosia bg-ardosia/14",
  nome: "text-ardosia-texto",
  linha: "border-l-ardosia",
};

/** A cor de cada profissional no ecrã, pela ordem alfabética do nome. */
export function coresDosProfissionais(
  profissionais: Iterable<{ id: number; nome: string | null | undefined }>,
): Map<number, CorDoProfissional> {
  const nomes = new Map<number, string>();
  for (const p of profissionais) {
    if (!nomes.has(p.id)) nomes.set(p.id, (p.nome || `Profissional #${p.id}`).toLocaleLowerCase("pt"));
  }
  const ordem = [...nomes].sort((a, b) => a[1].localeCompare(b[1], "pt") || a[0] - b[0]);
  const cores = new Map<number, CorDoProfissional>();
  ordem.forEach(([id], i) => cores.set(id, CORES_DOS_PROFISSIONAIS[i % CORES_DOS_PROFISSIONAIS.length]));
  return cores;
}

/** A cor de cada profissional pela ordem em que aparece no ecrã. */
export function coresPelaOrdem(ids: Iterable<number>): Map<number, CorDoProfissional> {
  const cores = new Map<number, CorDoProfissional>();
  for (const id of ids) {
    if (!cores.has(id)) cores.set(id, CORES_DOS_PROFISSIONAIS[cores.size % CORES_DOS_PROFISSIONAIS.length]);
  }
  return cores;
}
