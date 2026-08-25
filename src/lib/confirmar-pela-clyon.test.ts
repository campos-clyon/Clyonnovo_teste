import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { quemNegoceia, clyonPodeConfirmar, porqueNaoPodeConfirmar } from "./quem-negoceia";

/**
 * A CLYON confirma o trabalho em nome de quem não tem como o fazer.
 *
 * O BECO QUE ISTO FECHA
 *
 * O #206 chegou por WhatsApp: a cliente não tem email. O profissional fez o
 * trabalho e mandou a prova — e não havia ninguém no mundo que pudesse
 * confirmar. Sem link no email dela, sem conta onde entrasse, e sem botão no
 * painel. `confirmadoEm` ficava NULL para sempre, e é essa data que fecha o
 * trabalho, que deixa apagar o pedido, e que deixa apagar qualquer das duas
 * contas.
 *
 * O PORTÃO QUE ISTO NÃO PODE ABRIR
 *
 * Confirmar liberta o dinheiro do profissional. Se a CLYON pudesse fazê-lo em
 * qualquer pedido, a promessa da plataforma — "só paga depois de confirmar" —
 * passava a valer o que vale a boa-fé de quem está do lado de dentro.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA = ler("src/app/api/admin/negociacoes/agir/route.ts");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const CRON = ler("src/app/api/cron/libertar-por-prazo/route.ts");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const VERCEL = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };

describe("quem responde pelo lado do cliente", () => {
  it("é a CLYON quando o pedido foi registado pela equipa", () => {
    // Chegou por WhatsApp ou telefone: a pessoa nunca foi ao site.
    expect(quemNegoceia({ origem: "backoffice", contactEmail: "a@b.pt" })).toBe("clyon");
  });

  it("é a CLYON quando não há email", () => {
    // Sem email não há link, e sem link não há como responder.
    expect(quemNegoceia({ origem: "simulador", contactEmail: null })).toBe("clyon");
    expect(quemNegoceia({ origem: "simulador", contactEmail: "   " })).toBe("clyon");
  });

  it("é o cliente em tudo o resto", () => {
    expect(quemNegoceia({ origem: "simulador", contactEmail: "ana@exemplo.pt" })).toBe("cliente");
  });

  it("um cliente que pode confirmar sozinho não é confirmado por nós", () => {
    /*
     * ESTE É O TESTE QUE IMPORTA.
     *
     * Se isto passar a devolver `true`, a CLYON ganha o poder de libertar o
     * pagamento de qualquer profissional sem o cliente ter dito nada — e a
     * frase que o site repete em todas as páginas deixa de ser verdade.
     */
    const comEmail = { origem: "simulador", contactEmail: "ana@exemplo.pt" };
    expect(clyonPodeConfirmar(comEmail)).toBe(false);
    expect(porqueNaoPodeConfirmar(comEmail)).toContain("Só ele pode libertar");
  });

  it("diz porquê, para o ecrã não ficar mudo", () => {
    expect(porqueNaoPodeConfirmar({ origem: "backoffice", contactEmail: null })).toBeNull();
  });
});

describe("a rota", () => {
  it("aceita confirmar", () => {
    expect(ROTA).toContain('"confirmar"');
  });

  it("verifica o portão no SERVIDOR e não só no ecrã", () => {
    // A regra vivia dentro do painel, e servia para desenhar dois grupos. Um
    // portão que vive no browser não é um portão.
    expect(ROTA).toContain("clyonPodeConfirmar");
    expect(ROTA).toMatch(/status:\s*403/);
  });

  it("usa a mesma regra que o painel, e não uma cópia", () => {
    // Copiada em dois sítios, o dia em que uma delas mudasse era o dia em que
    // o ecrã escondia um botão que a rota continuava a aceitar.
    expect(ROTA).toContain('from "@/lib/quem-negoceia"');
    expect(PAINEL).toContain('from "@/lib/quem-negoceia"');
  });

  it("deixa escrito que foi a CLYON a confirmar", () => {
    /*
     * Um trabalho fechado pela CLYON e um fechado pelo cliente não são a mesma
     * coisa. No dia de um desacordo, esta é a única versão escrita.
     */
    expect(ROTA).toContain('acontecimento: "execucao_confirmada"');
    expect(ROTA).toContain('autorTipo: "clyon"');
  });
});

describe("o ecrã", () => {
  it("só mostra o botão a quem a CLYON representa mesmo", () => {
    expect(PAINEL).toContain("podeConfirmar={clyonPodeConfirmar(p)}");
    expect(PAINEL).toContain("negociacao.execucaoEnviadaEm && podeConfirmar");
  });

  it("mostra as três contas, e tira-as de taxas-plataforma", () => {
    // O painel dizia "200,00 €" e mais nada — o valor acordado, que não é o que
    // nenhuma das partes vê. Quem está ao telefone precisa do número certo.
    expect(PAINEL).toContain("quantoOClientePaga");
    expect(PAINEL).toContain("quantoOProfissionalRecebe");
    expect(PAINEL).toContain("comissaoDaClyon");
  });

  it("escreve o dinheiro com vírgula", () => {
    // Escrevia `{n.valorAcordado} €` — o valor cru da base — e saía "200.00 €".
    expect(semNotas(PAINEL)).not.toContain("{n.valorAcordado} €");
    expect(PAINEL).toContain("function euros(");
  });

  it("pede dois toques antes de libertar", () => {
    expect(PAINEL).toContain("Confirma que o trabalho está feito e pago?");
  });
});

describe("a libertação por prazo", () => {
  it("passou a ter quem a chame", () => {
    /*
     * `libertarTrabalhosPorPrazo` estava escrita em db.ts com o comentário a
     * explicar porque era precisa — e sem um único chamador. Código morto desde
     * o dia em que nasceu.
     *
     * A carteira calculava a libertação, por isso o profissional via o dinheiro
     * e ninguém deu por nada. Mas `confirmadoEm` ficava NULL, e um cliente que
     * simplesmente não voltasse ao site prendia para sempre o pedido dele, a
     * conta dele e a conta do profissional.
     */
    expect(CRON).toContain("libertarTrabalhosPorPrazo");
    expect(VERCEL.crons.some((c) => c.path === "/api/cron/libertar-por-prazo")).toBe(true);
  });

  it("corre todos os dias e não à segunda-feira", () => {
    // O prazo é de sete dias a contar da entrega. Num cron semanal, um trabalho
    // entregue à terça esperava até seis dias a mais por uma data já devida.
    const cron = VERCEL.crons.find((c) => c.path === "/api/cron/libertar-por-prazo");
    expect(cron?.schedule.split(" ")[4]).toBe("*");
    expect(cron?.schedule.split(" ")[2]).toBe("*");
  });

  it("falha fechada sem CRON_SECRET", () => {
    // Aberta, seria um endereço público que mexe em datas de pagamento.
    expect(CRON).toContain("if (!secret)");
    expect(CRON).toMatch(/status:\s*503/);
  });
});


describe("o ecrã das negociações da CLYON", () => {
  it("editar é um botão com nome, não um título clicável", () => {
    // O editar sempre existiu — era o título, clicável, sem nada que o
    // dissesse. Um botão que só se descobre por acidente não é um botão.
    expect(PAINEL).toContain("Abrir e editar tudo");
  });

  it("ver como o cliente abre a página verdadeira, não uma cópia", () => {
    /*
     * Uma pré-visualização desenhada à parte divergia da real na primeira
     * alteração à página. Abre-se `/pedido/[token]` noutro separador — o que
     * o admin vê é EXACTAMENTE o que o cliente vê.
     */
    expect(PAINEL).toContain("verComoCliente");
    expect(PAINEL).toMatch(/window\.open\(`\/pedido\/\$\{/);
  });

  it("avisa antes de matar um link que o cliente pode ter", () => {
    // Gerar link novo invalida o anterior. Sem email não há quem o tenha;
    // com email, pergunta-se primeiro.
    expect(PAINEL).toContain("o dele deixa de funcionar");
  });

  it("no ecrã próprio o título do grupo não se repete", () => {
    expect(PAINEL).toContain('mostrar !== "clyon" && (');
  });
});


describe("a distribuição do pedido", () => {
  const DIST = ler("src/lib/distribuicao-do-pedido.ts");
  const MODAL_PEDIDO = ler("src/components/admin/PedidoDetailModal.tsx");

  it("avalia TODOS os profissionais, não só os activos", () => {
    /*
     * `profissionaisActivos` filtra os suspensos à entrada — e "conta
     * suspensa" é precisamente um dos motivos que se quer ver. Vão todos
     * menos os apagados.
     */
    expect(DIST).toContain("estado <> 'apagado'");
    expect(DIST).not.toContain("profissionaisActivos(");
  });

  it("traduz os motivos para português de gente", () => {
    expect(DIST).toContain("conta suspensa ou por aprovar");
    expect(DIST).toContain("fora do raio e da zona");
  });

  it("um elegível sem negociação não passa por erro", () => {
    // Inscreveu-se depois do envio: é história, não avaria.
    expect(DIST).toContain("inscreveu-se ou ficou elegível depois do envio");
  });

  it("o modal do pedido tem o separador Distribuição", () => {
    expect(MODAL_PEDIDO).toContain('"distribuicao"');
    expect(MODAL_PEDIDO).toContain("Receberam o pedido");
    expect(MODAL_PEDIDO).toContain("Não receberam");
  });

  it("os cartões deixam de listar a parede de profissionais", () => {
    // Fechada por omissão atrás da linha da mesa — e desde a decisão dele,
    // SEMPRE fechada até o admin abrir; o accionável aponta-se no cartão
    // verde do topo e no botão "Responder (N)".
    expect(PAINEL).toContain("const aberto = negociacoesVisiveis.has(p.id);");
  });
});

describe("o rótulo do valor de abertura no lado do cliente", () => {
  it("não chama proposta do profissional ao valor do próprio cliente", () => {
    /*
     * "a sua proposta" ao lado do NOME do profissional lia-se como proposta
     * DELE — e ele ainda não tinha dito nada.
     */
    const PROPOSTAS = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(PROPOSTAS).toContain("o seu valor — à espera da resposta");
  });
});


describe("a edição da plataforma acontece na plataforma", () => {
  const EDITAR = ler("src/app/api/admin/pedidos/[id]/editar/route.ts");
  const FORM_REG = ler("src/components/admin/RegistarPedido.tsx");

  it("o botão do cartão abre o formulário da plataforma, não o modal executante", () => {
    /*
     * "Abrir e editar tudo" abria o modal dos Pedidos — "Aceitar pedido",
     * "Aprovar orçamento", preço final com IVA. Nada disso é a plataforma.
     */
    expect(PAINEL).toContain("setAEditarPlataforma(p.id)");
    expect(FORM_REG).toContain("editarId");
  });

  it("editar volta a localizar a morada — com a mesma rede da criação", () => {
    // O PATCH genérico gravava a morada nova e deixava as coordenadas VELHAS
    // no rawOrderJson: o pedido mudava de rua no ecrã e ficava no sítio
    // antigo para a regra do raio.
    expect(EDITAR).toContain("geocodificarMoradaDetalhado");
    expect(EDITAR).toContain("geocodificarLocalidade");
  });

  it("a edição fica assinada no histórico", () => {
    // Os profissionais leem o pedido da base a cada abertura — uma edição
    // muda o que eles veem, e isso não pode ser anónimo.
    expect(EDITAR).toContain("Pedido editado pela CLYON");
  });

  it("em edição não há botões de envio — salvo autorização explícita", () => {
    /*
     * A regra evoluiu com o fluxo da Distribuição: enviar continua fora da
     * edição por omissão (um pedido já publicado não se reenvia por
     * acidente), mas quem abre o editor PARA verificar-e-enviar liga-o com
     * `podeEnviarAoGravar` — e só quando ninguém recebeu ainda.
     */
    expect(FORM_REG).toContain("emEdicao && !podeEnviar ? null");
    expect(FORM_REG).toContain("podeEnviarAoGravar = false");
  });

  it("o rawOrderJson funde-se, não se substitui", () => {
    expect(EDITAR).toContain("...moradaAntiga");
  });
});


describe("o detalhe do pedido em telemóvel", () => {
  it("o cabeçalho empilha em ecrã estreito", () => {
    /*
     * Era uma linha única sempre: nome e chips à esquerda, sete botões com
     * flex-shrink-0 à direita — que recusa encolher. Num ecrã de 400px os
     * dois lados dobravam um por cima do outro: "Por atribuir" em cima do
     * "Aceitar pedido", o nome cortado a "Isab…".
     */
    const MODAL_PEDIDO = ler("src/components/admin/PedidoDetailModal.tsx");
    expect(MODAL_PEDIDO).toContain("flex flex-col gap-2 lg:flex-row lg:items-center");
    expect(MODAL_PEDIDO).not.toContain('"flex flex-shrink-0 flex-wrap items-center gap-1.5"');
  });
});


describe("a mesa de pedidos — opção B, escolhida no canvas", () => {
  it("cada linha diz onde está a bola sem abrir nada", () => {
    /*
     * A dor era "difícil de identificar qual trabalho recebeu proposta, de
     * quem e qual valor". A linha di-lo sempre; abrir é para agir, não para
     * descobrir.
     */
    expect(PAINEL).toContain("à espera de resposta");
    expect(PAINEL).toContain("Acordada por ");
    expect(PAINEL).toContain("Onde est");
  });

  it("a linha mostra o cliente e a contagem de propostas", () => {
    expect(PAINEL).toContain("totalPropostas");
    expect(PAINEL).toMatch(/Responder \(\$\{aEsperarLista\.length\}\)/);
  });

  it("aberta, mostra quem fez cada proposta e o valor em cima da mesa", () => {
    // "1 proposta" sem número era saber que havia sem ver quanto.
    expect(PAINEL).toContain('ultima.por === "profissional" ? "dele" : "nosso"');
  });

  it("os pedidos nascem FECHADOS — sempre, mesmo à espera de resposta", () => {
    /*
     * Decisão dele: "quando faço reset eles ficam mostrando todas as
     * propostas e não quero; tem que ser abertas apenas pelo admin". O
     * auto-abrir saiu; o cartão verde do topo aponta o dedo, e o salto dele
     * abre o pedido ao aterrar — senão aterrava numa linha fechada.
     */
    expect(PAINEL).toContain("const aberto = negociacoesVisiveis.has(p.id);");
    expect(PAINEL).not.toContain("negociacoesVisiveis.has(p.id) || espera");
    expect(PAINEL).toContain("setNegociacoesVisiveis((v) => new Set([...v, p.id]))");
  });

  it("um ecrã só gere todos os pedidos", () => {
    // Ao dar pela falta do pedido do Rui (com email, caía no outro ecrã):
    // "aqui devo gerir todos os pedidos". Gerir em dois sítios é gerir mal.
    const SHELL = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(SHELL).toContain('<AdminNegociacoesPanel mostrar="tudo" />');
    expect(SHELL).toContain('"profissionais", "negociacoes_clyon", "levantamentos"');
  });
});


describe("descarregar as fotos do pedido", () => {
  const MODAL_PEDIDO2 = ler("src/components/admin/PedidoDetailModal.tsx");

  it("vai buscar o ficheiro PELA NOSSA ORIGEM antes de o entregar", () => {
    /*
     * Duas lições do mesmo botão. Um <a download> directo não serve (o
     * atributo é ignorado noutra origem); e o fetch directo ao Blob também
     * não — o Blob da Vercel não manda CORS, o fetch falhava, e o plano B
     * abria separadores que o bloqueador de popups engolia a partir do
     * segundo. Ele viu-o: "abriu 2 imagens e nada aconteceu".
     */
    expect(MODAL_PEDIDO2).toContain("/api/admin/fotos?url=");
    expect(MODAL_PEDIDO2).toContain("URL.createObjectURL(blob)");
  });

  it("o proxy só aceita o nosso armazenamento", () => {
    // Um proxy que busca "o URL que vier" é uma porta de SSRF — o servidor a
    // bater em endpoints internos por ordem de quem chama.
    const PROXY = ler("src/app/api/admin/fotos/route.ts");
    expect(PROXY).toContain('.public.blob.vercel-storage.com');
    expect(PROXY).toContain('alvo.protocol !== "https:"');
    expect(PROXY).toContain("attachment; filename=");
    expect(PROXY).toContain("requireAdmin");
  });

  it("a rede a falhar abre o separador em vez de morrer calado", () => {
    expect(MODAL_PEDIDO2).toContain('window.open(url, "_blank", "noopener")');
  });

  it("há descarregar todas, em série", () => {
    // Em paralelo, o browser bloqueia a rajada; em série com intervalo,
    // pergunta uma vez e o resto segue.
    expect(MODAL_PEDIDO2).toContain("descarregarTodas");
    expect(MODAL_PEDIDO2).toContain("Descarregar todas");
  });

  it("o nome do ficheiro diz de que pedido veio", () => {
    expect(MODAL_PEDIDO2).toContain("pedido-${pedidoId}-foto-");
  });
});


describe("enviar a partir da Distribuição — sempre com verificação primeiro", () => {
  const MODAL3 = ler("src/components/admin/PedidoDetailModal.tsx");
  const FORM3 = ler("src/components/admin/RegistarPedido.tsx");
  const EDITAR3 = ler("src/app/api/admin/pedidos/[id]/editar/route.ts");

  it("o botão abre o editor, não dispara o envio", () => {
    // Foi o #220 que ditou a regra: quatro profissionais a propor às cegas
    // sobre um pedido sem descrição. Enviar passa SEMPRE pela verificação.
    expect(MODAL3).toContain("Verificar e enviar aos profissionais");
    expect(MODAL3).toContain("setAVerificar(true)");
    expect(MODAL3).toContain("podeEnviarAoGravar");
  });

  it("só aparece enquanto ninguém recebeu", () => {
    expect(MODAL3).toContain("dados.receberam.length === 0 && (");
  });

  it("no editor, o enviar só existe depois de gravar — e só com autorização", () => {
    // Em edição normal os botões de envio não existem; a Distribuição é a
    // excepção deliberada, e mesmo aí o enviar vive no painel do resultado,
    // que só aparece depois do gravar.
    expect(FORM3).toContain("emEdicao && !podeEnviar ? null");
  });

  it("a rota de editar devolve o valor de partida para o envio", () => {
    // Sem ele, a promoção caía na estimativa mesmo quando o cliente disse
    // quanto queria pagar.
    expect(EDITAR3).toContain("valorDePartida: valorDesejado");
  });
});
