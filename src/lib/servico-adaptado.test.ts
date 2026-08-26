import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { camposDoServico } from "./campos-do-servico";
import {
  CAMPOS_VISIVEIS_AO_PROFISSIONAL,
  CAMPOS_VISIVEIS_DEPOIS_DE_CONTRATADO,
  vistaDoProfissional,
  vistaDoProfissionalContratado,
} from "./pedido-valores";
import { estimateLaborHours } from "./pricing-helper";

/**
 * Cada serviço pergunta o que lhe interessa.
 *
 * "Quando eu escolho mudanças o pedido deveria ser adaptado a isso, assim como
 * entulhos etc — cada material tem sua peculiaridade. Mudanças precisam de 2
 * endereços, o valor é por hora e km, sendo o mínimo de 3h."
 *
 * O motor de preços sabia disto desde sempre: uma mudança são sete horas de
 * base, mais uma por cada ponta sem elevador acima do 2.º andar, mais meia
 * hora por acesso difícil, mais meia hora acima de 30 km de percurso — e
 * depois cobra-se por hora, com um mínimo de três. O que faltava era alguém
 * lhe dar os números: o formulário do backoffice mandava sempre os mesmos
 * cinco campos, e uma mudança para o prédio ao lado custava o mesmo que uma
 * para o Porto.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const FORMULARIO = ler("src/components/admin/RegistarPedido.tsx");
const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
const DB = ler("src/lib/db.ts");

// ─── O motor já sabia: é a prova de que os campos valem alguma coisa ──────

describe("o motor responde aos campos", () => {
  const mudanca = { serviceType: "mudanca" };

  it("uma mudança são 7 horas de base", () => {
    expect(estimateLaborHours(mudanca)).toBe(7);
  });

  it("cada ponta sem elevador acima do 2.º andar vale uma hora", () => {
    const soOrigem = estimateLaborHours({
      ...mudanca,
      originAccess: { floor: "5", hasElevator: "no" },
    });
    const asDuas = estimateLaborHours({
      ...mudanca,
      originAccess: { floor: "5", hasElevator: "no" },
      destinationAccess: { floor: "4", hasElevator: "no" },
    });
    expect(soOrigem).toBe(8);
    expect(asDuas).toBe(9);
  });

  it("um percurso acima de 30 km vale meia hora", () => {
    expect(estimateLaborHours({ ...mudanca, movingDistance: { distanceKm: 45 } })).toBe(7.5);
    expect(estimateLaborHours({ ...mudanca, movingDistance: { distanceKm: 12 } })).toBe(7);
  });

  it("o entulho conta-se por sacos, e no chão dá mais trabalho", () => {
    const ensacado = estimateLaborHours({
      serviceType: "recolha_entulho",
      entulhoQuantidade: "100",
      entulhoState: "ensacado",
    });
    const noChao = estimateLaborHours({
      serviceType: "recolha_entulho",
      entulhoQuantidade: "100",
      entulhoState: "chao",
    });
    expect(noChao).toBeGreaterThan(ensacado);
    // E o número importa: 300 sacos não são 30.
    expect(
      estimateLaborHours({ serviceType: "recolha_entulho", entulhoQuantidade: "300" }),
    ).toBeGreaterThan(
      estimateLaborHours({ serviceType: "recolha_entulho", entulhoQuantidade: "30" }),
    );
  });
});

// ─── A leitura do formulário ──────────────────────────────────────────────

describe("camposDoServico", () => {
  it("um serviço normal não ganha campos nenhuns", async () => {
    const r = await camposDoServico({ serviceType: "recolha_moveis" }, { lat: 38.6, lng: -9.1 });
    expect(r.paraOJson).toEqual({});
    expect(r.paraOMotor).toEqual({});
    expect(r.emFalta).toEqual([]);
    expect(r.percursoKm).toBeNull();
  });

  it("uma mudança leva o acesso das DUAS pontas ao motor", async () => {
    const r = await camposDoServico(
      {
        serviceType: "mudanca",
        floor: "3",
        hasElevator: "no",
        parkingDistance: "difficult",
        andarDestino: "5",
        elevadorDestino: "yes",
        estacionamentoDestino: "easy",
        acessoDificilDestino: true,
      },
      null,
    );
    expect(r.paraOMotor.originAccess).toMatchObject({ floor: "3", hasElevator: "no" });
    expect(r.paraOMotor.destinationAccess).toMatchObject({
      floor: "5",
      hasElevator: "yes",
      difficultAccess: true,
    });
  });

  it("uma mudança sem destino diz o que falta, em vez de fingir um preço", async () => {
    const r = await camposDoServico({ serviceType: "mudanca" }, { lat: 38.6, lng: -9.1 });
    expect(r.emFalta).toContain("a morada de destino");
    expect(r.percursoKm).toBeNull();
  });

  it("um entulho sem número de sacos diz o que falta", async () => {
    const r = await camposDoServico({ serviceType: "recolha_entulho" }, null);
    expect(r.emFalta).toContain("o número de sacos");
    expect(r.emFalta).toContain("o estado do entulho");
  });

  it("trinta sacos escritos por extenso valem trinta", async () => {
    const r = await camposDoServico(
      { serviceType: "recolha_entulho", entulhoEstado: "chao", entulhoQuantidade: "30 sacos" },
      null,
    );
    expect(r.paraOMotor.entulhoQuantidade).toBe("30");
    expect(r.paraOMotor.entulhoState).toBe("chao");
    expect(r.emFalta).toEqual([]);
  });
});

// ─── O que o profissional pode ver, e quando ──────────────────────────────

describe("o que chega ao profissional", () => {
  const pedido = {
    id: 1,
    city: "Almada",
    address: "Rua José Fontana, 23",
    moradaDestino: "Avenida da República, 12, Lisboa",
    localidadeDestino: "Lisboa",
    percursoKm: 14.2,
    entulhoQuantidade: "30",
    contactPhone: "912345678",
  };

  it("antes do acordo vê a localidade do destino — nunca a morada", () => {
    const v = vistaDoProfissional(pedido) as Record<string, unknown>;
    expect(v.localidadeDestino).toBe("Lisboa");
    expect(v.percursoKm).toBe(14.2);
    expect(v.entulhoQuantidade).toBe("30");
    // As duas moradas ficam de fora, e pela mesma razão: uma mudança tem duas
    // casas, e se a segunda saísse aqui bastava inscrever-se para as colher às
    // pares, com o telefone ao lado.
    expect(v.moradaDestino).toBeUndefined();
    expect(v.address).toBeUndefined();
    expect(v.contactPhone).toBeUndefined();
  });

  it("depois de contratado abrem-se as duas moradas", () => {
    const v = vistaDoProfissionalContratado(pedido) as Record<string, unknown>;
    expect(v.address).toBe("Rua José Fontana, 23");
    expect(v.moradaDestino).toBe("Avenida da República, 12, Lisboa");
  });

  it("as listas não se contradizem", () => {
    expect(CAMPOS_VISIVEIS_AO_PROFISSIONAL).not.toContain("moradaDestino");
    expect(CAMPOS_VISIVEIS_DEPOIS_DE_CONTRATADO).toContain("moradaDestino");
    expect(CAMPOS_VISIVEIS_AO_PROFISSIONAL).toContain("localidadeDestino");
  });

  it("a consulta vai mesmo buscá-los — a lista de campos não chega", () => {
    // Precedente: a API anunciava andar, elevador e estacionamento há meses e
    // o SQL nunca os seleccionou. Chegavam sempre nulos e ninguém dava por isso.
    const i = DB.indexOf("export async function negociacoesDoProfissional");
    const consulta = DB.slice(i, DB.indexOf("ORDER BY", i));
    for (const campo of [
      "destinationAddress",
      "destinationAccess",
      "movingDistance",
      "entulhoState",
      "entulhoQuantidade",
    ]) {
      expect(consulta).toContain(campo);
    }
  });

  it("o ecrã dele mostra as duas coisas", () => {
    expect(TRABALHOS).toContain("Para onde vai");
    expect(TRABALHOS).toContain("O entulho");
    // A morada exacta só quando o trabalho é dele.
    expect(TRABALHOS).toContain("fechado ? pedido.moradaDestino");
  });
});

// ─── O formulário pergunta o que o serviço pede ───────────────────────────

describe("o formulário", () => {
  it("a segunda morada só aparece numa mudança", () => {
    expect(FORMULARIO).toContain("PRECISA_DE_DOIS_ENDERECOS");
    expect(FORMULARIO).toContain("{doisEnderecos && (");
    expect(FORMULARIO).toContain("Morada de destino");
  });

  it("os sacos só aparecem num entulho", () => {
    expect(FORMULARIO).toContain("{pedeSacos && (");
    expect(FORMULARIO).toContain("Quantos sacos?");
  });

  it("a morada principal passa a chamar-se origem quando há duas", () => {
    expect(FORMULARIO).toContain("Morada de origem");
  });

  it("o editor recupera os campos do rawOrderJson", () => {
    // Sem isto, editar uma mudança abria com o destino em branco e gravava-o
    // vazio — e agora que gravar recomeça o pedido, apagava-o a sério.
    expect(FORMULARIO).toContain("camposDoServicoGuardados(o.rawOrderJson)");
  });

  it("o ecrã avisa quando o preço é só o mínimo", () => {
    expect(FORMULARIO).toContain("Este preço é um piso, não uma conta.");
  });
});
