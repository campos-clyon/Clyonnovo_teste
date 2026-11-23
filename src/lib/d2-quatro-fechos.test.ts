// relógio: datas explícitas em todas as chamadas — nada aqui lê o dia de hoje.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { descricaoSemContactos } from "./filtro-de-contactos";
import { codigoPostalSemOsUltimos, vistaDoProfissional, vistaDoProfissionalContratado } from "./pedido-valores";
import { maquinaConhecida, valorDaMaquina } from "./maquina-conhecida";

/**
 * D2 (CEO e dono, 23-11-2026) — quatro fechos: o Next.js, o contacto do cliente
 * só depois da escolha, o travão do código só com as falhas, e o limite das
 * respostas depois de confirmar de quem é o pedido.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("d2 (1) — o Next.js e o cabeçalho", () => {
  it("next e eslint-config-next na 15.5.29 e sem X-Powered-By", () => {
    const pkg = JSON.parse(ler("package.json"));
    const versao = (v: string) => v.replace(/^[\^~]/, "");
    expect(versao(pkg.dependencies.next)).toBe("15.5.29");
    expect(versao((pkg.devDependencies ?? pkg.dependencies)["eslint-config-next"])).toBe("15.5.29");
    expect(ler("next.config.ts")).toMatch(/poweredByHeader:\s*false/);
  });
});

describe("d2 (2) — a descrição sem contactos, o código postal com quatro dígitos", () => {
  it("um telefone e um email na descrição saem, e o original fica à parte", () => {
    const r = descricaoSemContactos("Sofá de 3 lugares. Ligue para 912 345 678 ou escreva a ana@exemplo.pt, 2.º andar.");
    expect(r.description).not.toMatch(/912|exemplo\.pt/);
    expect(r.description).toContain("[contacto escondido");
    expect(r.description).toContain("Sofá de 3 lugares");
    expect(r.descricaoComContactos).toContain("912 345 678");
  });

  it("uma descrição sem contactos fica tal e qual, sem original", () => {
    const d = "Sofá, 2 cadeiras e uma mesa. Elevador pequeno, 3.º andar, 14h30.";
    expect(descricaoSemContactos(d)).toEqual({ description: d });
  });

  it("todos os pedidos passam pelo filtro: a base, o simulador e a inicial", () => {
    expect(ler("src/lib/db.ts")).toContain("descricaoSemContactos(data.description)");
    expect(ler("src/app/api/simulador/pedido/route.ts")).toContain("...descricaoSemContactos(order.description || null)");
    expect(ler("src/app/api/hero-quote/route.ts")).toContain("...descricaoSemContactos(descricao || null)");
  });

  it("o parceiro não vê a descrição original antes de ser contratado, e vê-a depois", () => {
    const pedido = {
      id: 7,
      description: "Sofá. [contacto escondido — a CLYON guarda o acordo]",
      descricaoComContactos: "Sofá. Ligue 912345678",
      postalCode: "2975-123",
      contactPhone: "912345678",
    };
    const antes = vistaDoProfissional(pedido);
    expect(JSON.stringify(antes)).not.toContain("912345678");
    expect(antes.description).toContain("[contacto escondido");
    const depois = vistaDoProfissionalContratado(pedido) as Record<string, unknown>;
    expect(depois.description).toBe("Sofá. Ligue 912345678");
    expect(depois.postalCode).toBe("2975-123");
  });

  it("antes da escolha o código postal vai só com os 4 primeiros dígitos", () => {
    expect(codigoPostalSemOsUltimos("2975-123")).toBe("2975");
    expect(codigoPostalSemOsUltimos("2975123")).toBe("2975");
    expect(codigoPostalSemOsUltimos("xx")).toBeNull();
    expect(vistaDoProfissional({ postalCode: "1500-200" }).postalCode).toBe("1500");
  });

  it("a consulta dos parceiros lê a coluna nova só para a vista do contratado", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("o.description, o.descricaoComContactos, o.valorDesejadoCliente");
    const lista = ler("src/lib/pedido-valores.ts");
    const antes = lista.slice(lista.indexOf("CAMPOS_VISIVEIS_AO_PROFISSIONAL = ["), lista.indexOf("] as const"));
    expect(antes).not.toContain("descricaoComContactos");
  });
});

describe("d2 (3) — o travão do código só conta as falhas", () => {
  it("o cookie da máquina conhecida dura 30 dias e não se forja", () => {
    const seg = "segredo-de-teste-com-tamanho-suficiente";
    const agora = new Date("2026-11-23T12:00:00Z");
    const v = valorDaMaquina(seg, agora);
    expect(maquinaConhecida(v, seg, agora)).toBe(true);
    expect(maquinaConhecida(v, seg, new Date("2026-12-20T12:00:00Z"))).toBe(true);
    expect(maquinaConhecida(v, seg, new Date("2026-12-24T12:00:00Z"))).toBe(false);
    expect(maquinaConhecida(v, "outro-segredo", agora)).toBe(false);
    expect(maquinaConhecida(undefined, seg, agora)).toBe(false);
  });
});

describe("d2 (4) — o limite das respostas conta-se depois de confirmar de quem é o pedido", () => {
  it("o limite por pedido vem depois do 404", () => {
    const f = ler("src/app/api/cliente/pedidos/[id]/resposta/route.ts");
    const i404 = f.indexOf("Pedido não encontrado.");
    const iLimite = f.indexOf('limitarPorConta("cliente-resposta-pedido"');
    expect(i404).toBeGreaterThan(0);
    expect(iLimite).toBeGreaterThan(i404);
  });
});
