import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A morada ditada ao telefone, do formulário até ao Google.
 *
 * O QUE ACONTECEU
 *
 * O formulário tem três campos — morada, código postal, localidade — e a
 * consulta ao Google só levava dois. O placeholder da morada ainda por cima
 * dizia "Rua, número, localidade": mandava pôr a localidade no campo errado,
 * ao lado do campo certo.
 *
 * E quando o servidor não tinha chave do Google, o aviso era "vale a pena
 * corrigir a morada" — quem registava pedidos reescreveu três vezes uma morada
 * que o Google encontra à primeira, contra um servidor que nunca chegou a
 * consultar o Google.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const GEO = ler("src/lib/geocodificar.ts");
const ROTA = ler("src/app/api/admin/pedidos/criar/route.ts");
const FORM = ler("src/components/admin/RegistarPedido.tsx");
const COORD = ler("src/lib/coordenadas-do-pedido.ts");

const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a consulta ao Google", () => {
  it("leva os três campos, não dois", () => {
    // "Rua Sousa Viterbo 29, 1900-424" ia sem o "Lisboa" que estava escrito
    // mesmo ao lado, no campo próprio.
    expect(GEO).toContain("[morada, codigoPostal, localidade]");
  });

  it("tenta de novo sem o código postal quando falha", () => {
    /*
     * Um CP ditado ao telefone é o campo mais fácil de ouvir mal — um dígito
     * trocado e o Google devolve ZERO_RESULTS para uma rua que conhece. O CP
     * errado não pode valer mais do que a morada certa.
     */
    expect(GEO).toContain("const semCP = [morada, localidade]");
  });

  it("a rota do backoffice passa a localidade", () => {
    expect(semNotas(ROTA)).toContain("geocodificarMoradaDetalhado(address, postalCode, city)");
  });

  it("a segunda geocodificação (na promoção) também", () => {
    expect(semNotas(COORD)).toContain("geocodificarMoradaDetalhado(texto, cp, cidade)");
  });
});

describe("o ecrã diz a verdade sobre a falha", () => {
  it("distingue chave em falta de morada não encontrada", () => {
    /*
     * Sem chave, NENHUMA morada vai ser localizada — dizer "corrija a morada"
     * manda a pessoa procurar no sítio errado, e foi o que aconteceu: três
     * versões da mesma rua, todas "não localizadas".
     */
    expect(ROTA).toContain('"sem_chave"');
    expect(ROTA).toContain('"nao_encontrada"');
    expect(FORM).toContain('motivoSemCoordenadas === "sem_chave"');
    expect(FORM).toContain("GOOGLE_MAPS_SERVER_API_KEY");
    expect(FORM).toContain("Não é um problema desta morada");
  });
});

describe("o formulário pede a morada de forma coerente", () => {
  it("o campo morada é rua e número — a localidade tem campo próprio", () => {
    // O placeholder dizia "Rua, número, localidade" com o campo Localidade
    // mesmo ao lado. Quem seguia a dica dava ao Google o mesmo dado duas vezes
    // e quem não seguia dava-lhe menos do que o formulário prometia.
    expect(semNotas(FORM)).not.toContain('"Rua, número, localidade"');
    expect(FORM).toContain("Rua e número");
    expect(FORM).toContain("Só a rua e o número.");
  });
});


describe("as perguntas do telefone", () => {
  it("elevador, estacionamento e data têm campo próprio", () => {
    /*
     * "Segundo andar sem elevador" escrito na descrição não mudava um cêntimo
     * na estimativa — o motor de preços lê campos, não prosa. Estes três iam
     * sempre parar à descrição.
     */
    expect(FORM).toContain('muda("hasElevator"');
    expect(FORM).toContain('muda("parkingDistance"');
    expect(FORM).toContain('muda("dataDesejada"');
  });

  it("com o vocabulário que o motor de preços lê", () => {
    // Etiquetas novas com valores novos dariam campos preenchidos e preços
    // iguais: o motor procura "yes"/"small"/"no" e "difficult".
    for (const v of ['value="yes"', 'value="small"', 'value="no"', 'value="difficult"']) {
      expect(FORM, `falta ${v}`).toContain(v);
    }
  });

  it("a rota grava a data e deriva a urgência dela", () => {
    expect(ROTA).toContain("dataAgendada");
    expect(ROTA).toMatch(/dias < 1 \? "today" : dias < 2 \? "tomorrow" : dias < 7 \? "this_week" : "flexible"/);
  });

  it("uma data no passado não vira agendamento", () => {
    expect(ROTA).toContain("d.getTime() > Date.now() - 3600_000");
  });
});

describe("o que o Google responde deixa de se perder", () => {
  it("a chave recusada distingue-se da morada não encontrada", () => {
    /*
     * "ZERO_RESULTS" é a morada; "REQUEST_DENIED" é a chave — restrita à API
     * errada ou por activar. O painel mostrava os dois como "não localizada",
     * e corrigia-se a morada certa enquanto o problema era o Google Cloud.
     */
    expect(ROTA).toContain('"chave_recusada"');
    expect(ROTA).toContain('"REQUEST_DENIED"');
    expect(FORM).toContain('motivoSemCoordenadas === "chave_recusada"');
  });

  it("o estado do Google fica no registo do servidor", () => {
    expect(GEO).toContain('console.warn("[geocodificarMorada]", dados.status');
  });
});

describe("a localidade limpa-se à entrada", () => {
  it("o ', Portugal' do preenchimento automático cai", () => {
    /*
     * A elegibilidade compara zonas por igualdade: "lisboa, portugal" nunca
     * bate com a zona "lisboa" de ninguém. Foi o #214 — quatro profissionais
     * activos, zero alcançados, um deles a cobrir Lisboa por extenso.
     */
    expect(ROTA).toMatch(/portugal.*\$\/i/);
  });
});


describe("as fotografias do WhatsApp", () => {
  it("o formulário deixa juntá-las, pelo caminho do simulador", () => {
    // Um segundo caminho de upload seria um segundo sítio onde as fotos se
    // perdem — o enviarFicheiro comprime e sobe uma de cada vez, já testado.
    expect(FORM).toContain("@/lib/enviar-ficheiro");
    expect(FORM).toContain('accept="image/*"');
  });

  it("a rota só grava entradas com url, e no formato do simulador", () => {
    // Uma linha sem url não é uma foto: é o painel a dizer que há fotos
    // quando não há nenhuma.
    expect(ROTA).toContain('typeof ft.url === "string"');
    expect(ROTA).toContain("filesJson: fotos.length > 0");
  });
});


describe("as coordenadas para o raio", () => {
  const COORD = ler("src/lib/coordenadas-do-pedido.ts");
  const MODAL = ler("src/components/admin/PedidoDetailModal.tsx");

  it("quando o Google falha, o Nominatim entra pela freguesia", () => {
    /*
     * O Google pode falhar por razões que nada têm a ver com a morada — chave
     * recusada, API por activar. Nesse dia TODOS os pedidos ficavam sem
     * coordenadas e a elegibilidade caía nas zonas escritas à mão: um trabalho
     * a 25 km "não chegava" a quem cobre 200. O centro da freguesia erra por
     * um ou dois quilómetros; contra raios de 50 a 200, o erro não muda nada.
     */
    expect(COORD).toContain("geocodificarLocalidade");
    expect(COORD).toContain("coordenadasAproximadas");
  });

  it("o detalhe do pedido mostra se as coordenadas existem", () => {
    // O #217 parecia completo no admin e não tinha nenhuma — a diferença era
    // invisível e decidia toda a distribuição.
    expect(MODAL).toContain("Coordenadas para o raio");
    expect(MODAL).toContain("SEM coordenadas");
    expect(MODAL).toContain("Localizar agora");
  });

  it("o botão usa o mesmo caminho da promoção", () => {
    // O que se vê ao carregar no botão é o que vai acontecer no "Enviar aos
    // profissionais" — dois caminhos dariam duas respostas.
    const ROTA_LOC = ler("src/app/api/admin/pedidos/[id]/localizar/route.ts");
    expect(ROTA_LOC).toContain("coordenadasDoPedido(pedido)");
  });
});
