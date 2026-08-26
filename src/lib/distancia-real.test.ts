import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estimativaEmLinhaRecta } from "./distancia-rodoviaria";

/**
 * As distâncias passam a ser medidas pela estrada.
 *
 * "Esses cálculos de km estão muito errados. Temos que usar valores reais e
 * calculados individualmente usando o endereço base do pro com o do pedido —
 * reais e verdadeiros."
 *
 * Era linha recta vezes 1,3. Serviu enquanto o número era um indício; deixou
 * de servir quando passou a decidir quem recebe o pedido e quanto rende por
 * quilómetro.
 *
 * O erro não é constante. De Amora a Setúbal a estrada são 33,4 km e a
 * aproximação dá 29,6 — 11% a menos. Entre Almada e o Montijo, vizinhos por
 * cima da água, passa dos 60%.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** O ficheiro sem os comentários — a explicação não é o código que ela explica. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const LIB = ler("src/lib/distancia-rodoviaria.ts");
const LIB_LIMPA = semComentarios(LIB);
const PAINEL = ler("src/app/api/profissionais/meus-pedidos/route.ts");
const DISTRIBUIR = ler("src/lib/distribuir-pedido.ts");
const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");
const CAMPO = ler("src/app/profissionais/painel/MoradaDaBase.tsx");

describe("a medição", () => {
  it("pergunta à estrada, e não ao teorema de Pitágoras", () => {
    expect(LIB).toContain("routes.googleapis.com/directions/v2:computeRoutes");
    expect(LIB).toContain('travelMode: "DRIVE"');
  });

  it("sem trânsito — senão o mesmo trabalho mudava de raio às seis da tarde", () => {
    // Isto é guardado e reutilizado. Um profissional não pode ficar fora do
    // raio por ter havido fila na ponte.
    expect(LIB).toContain('routingPreference: "TRAFFIC_UNAWARE"');
    expect(LIB_LIMPA).not.toContain("TRAFFIC_AWARE");
  });

  it("tem memória, com a chave arredondada para ela acertar", () => {
    // As coordenadas do Google variam no último dígito entre consultas da
    // mesma morada. Sem arredondar, a memória nunca acertava.
    expect(LIB).toContain("CREATE TABLE IF NOT EXISTS distanciasRodoviarias");
    expect(LIB).toContain("Math.round(n * 10_000) / 10_000");
  });

  it("nunca atira: sem Google, cai na linha recta e diz que é estimativa", () => {
    const r = estimativaEmLinhaRecta({ lat: 38.6233, lng: -9.1219 }, { lat: 38.5322, lng: -8.887 });
    expect(r.origem).toBe("estimativa");
    expect(r.km).toBeGreaterThan(25);
    expect(r.km).toBeLessThan(35);
    expect(r.minutos).toBeNull();
  });

  it("um ponto em falta devolve nada, e não zero", () => {
    // Zero quilómetros é «está à porta». Um pedido sem morada localizada não
    // está à porta de ninguém.
    expect(LIB).toContain("if (!pontoValido(origem) || !pontoValido(destino)) return null;");
  });
});

describe("os dois lados vêem o mesmo número", () => {
  it("o painel do profissional mede pela estrada", () => {
    expect(PAINEL).toContain("distanciasRodoviarias");
    expect(PAINEL).toContain("distanciaMedidaPor");
  });

  it("a distribuição e o alcance também", () => {
    // É a distância que decide quem recebe o pedido. Se o backoffice medisse
    // de uma maneira e o painel dele de outra, os dois números discordavam no
    // ecrã e nenhum dos dois merecia confiança.
    expect(DISTRIBUIR).toContain("distanciasRodoviarias");
    expect((DISTRIBUIR.match(/distanciasRodoviarias\(/g) ?? []).length).toBe(2);
  });

  it("o ecrã diz se o número foi medido ou estimado", () => {
    // Apresentar um palpite como medição é pior do que não haver número.
    const tipos = ler("src/app/profissionais/painel/tipos.ts");
    expect(tipos).toContain('medidaPor === "estrada"');
    expect(tipos).toContain("de carro, da sua base");
    expect(tipos).toContain("cerca de");
  });
});

describe("a base deixa de ser um palpite sobre um texto", () => {
  it("o campo tem lista, e guarda as coordenadas do que foi escolhido", () => {
    expect(CAMPO).toContain("places.search");
    expect(CAMPO).toContain("places.resolve");
    expect(CAMPO).toContain("lat: r.lat");
  });

  it("escrever apaga as coordenadas antigas", () => {
    // Morada nova com o ponto velho colado é a pior combinação possível: um
    // ecrã a dizer «confirmada» sobre um sítio que já não é aquele.
    expect(CAMPO).toContain("onMudar({ morada: texto, lat: null, lng: null });");
  });

  it("diz-lhe se a base está confirmada no mapa", () => {
    expect(CAMPO).toContain("Base confirmada no mapa");
    expect(CAMPO).toContain("Ainda não escolheu da lista");
  });

  it("o servidor prefere as coordenadas escolhidas à sua própria adivinha", () => {
    expect(PERFIL).toContain("const escolhidas =");
    expect(PERFIL).toContain("escolhidas ?? (await geocodificarLocalidade(c))");
  });
});
