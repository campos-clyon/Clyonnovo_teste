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
    expect(semNotas(ROTA)).toContain("geocodificarMorada(address, postalCode, city)");
  });

  it("a segunda geocodificação (na promoção) também", () => {
    expect(semNotas(COORD)).toContain("geocodificarMorada(texto, cp, cidade)");
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
