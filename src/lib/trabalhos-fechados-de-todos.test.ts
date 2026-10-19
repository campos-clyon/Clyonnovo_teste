import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pedidoFechadoDaLinha } from "./pedidos-fechados";

/**
 * CONCLUÍDOS, CANCELADOS E ARQUIVADOS SÃO DE TODOS — 17-10-2026.
 *
 * *«Coloque também a opção dos trabalhos arquivados, mas quero que trabalhos
 * arquivados, concluídos e cancelados reúna todos os trabalhos.»* — o dono,
 * que escolheu «todos os pedidos»: nos Trabalhos CLYON, estes três
 * separadores mostram também os pedidos normais da plataforma.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/AdminTrabalhosClyonPanel.tsx");

const linha = (extra: Record<string, unknown> = {}) => ({
  id: 401,
  status: "concluido",
  serviceType: "recolha_moveis",
  city: "Almada",
  address: "Rua A, 1",
  contactName: " Ana ",
  contactPhone: "912 345 678",
  assignedToName: null,
  concluidoEm: "2026-10-12 10:00:00",
  updatedAt: "2026-10-14 18:00:00",
  valorAcordado: "120.50",
  providerId: 9,
  profissional: "TRSul",
  ...extra,
});

describe("um pedido normal fechado", () => {
  it("fica com o estado, o profissional, o operador e o valor acordado", () => {
    expect(pedidoFechadoDaLinha(linha())).toMatchObject({
      pedidoId: 401,
      estado: "concluido",
      cliente: "Ana",
      profissional: "TRSul",
      providerId: 9,
      operador: "Admin",
      valorAcordado: 120.5,
    });
  });

  it("concluído conta da conclusão; cancelado ou arquivado, da última mexida", () => {
    expect(pedidoFechadoDaLinha(linha())!.quando).toBe(pedidoFechadoDaLinha(linha({ updatedAt: "2026-10-12 10:00:00" }))!.quando);
    const arquivado = pedidoFechadoDaLinha(linha({ status: "arquivado" }))!;
    expect(arquivado.estado).toBe("arquivado");
    expect(arquivado.quando).not.toBe(pedidoFechadoDaLinha(linha())!.quando);
  });

  it("sem negociação, sem valor; e um estado aberto não entra", () => {
    expect(pedidoFechadoDaLinha(linha({ valorAcordado: null, providerId: null, profissional: null }))).toMatchObject({
      valorAcordado: null,
      providerId: null,
      profissional: null,
    });
    expect(pedidoFechadoDaLinha(linha({ status: "confirmado" }))).toBeNull();
  });
});

describe("a leitura e a rota", () => {
  it("lê os pedidos normais (sem valor fixo da CLYON) concluídos, cancelados e arquivados", () => {
    const db = ler("src/lib/pedidos-fechados.ts");
    expect(db).toContain("WHERE o.status IN ('concluido', 'cancelado', 'arquivado')");
    expect(db).toContain("AND o.valorFixoClyon IS NULL");
    expect(db).toContain("WHERE estado = 'acordada'");
  });

  it("vêm com os Trabalhos CLYON, e se falharem os Trabalhos CLYON aparecem na mesma", () => {
    const rota = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    const get = rota.slice(rota.indexOf("export async function GET"), rota.indexOf("export async function POST"));
    expect(get).toContain("pedidosFechadosDaPlataforma(tudo ? 1000 : undefined).catch(");
    expect(get).toContain("      outros,");
  });
});

describe("o ecrã", () => {
  it("tem o bloco dos Arquivados, e os três fechados levam os pedidos normais", () => {
    expect(PAINEL).toContain('id: "arquivados",');
    for (const estado of ['estado: "concluido",', 'estado: "cancelado",', 'estado: "arquivado",']) {
      expect(PAINEL, estado).toContain(estado);
    }
    // Em blocos desde 19-10-2026, como a Mesa.
    expect(PAINEL).toContain("...(b.estado ? outrosEncontrados.filter((p) => p.estado === b.estado).map((p) => ({ id: p.pedidoId, p })) : []),");
  });

  it("um Trabalho CLYON de pedido arquivado vai para os Arquivados, e não para os Cancelados", () => {
    expect(PAINEL).toContain('if (t.estadoDoPedido === "arquivado") return "arquivados";');
    expect(PAINEL).toContain("...encontrados.filter((t) => blocoDoTrabalho(t) === b.id).map((t) => ({ id: t.pedidoId, t })),");
  });

  it("as contagens e a lista somam os dois", () => {
    expect(PAINEL).toContain("const quantosEm = (id: Bloco) => porBloco.get(id)?.length ?? 0;");
    expect(PAINEL).toContain("const totalEncontrado = encontrados.length + outrosEncontrados.length;");
    expect(PAINEL).toContain("<CartaoDoPedidoFechado");
  });

  it("o cartão de um pedido normal também nasce fechado", () => {
    const cartao = PAINEL.slice(PAINEL.indexOf("function CartaoDoPedidoFechado("));
    expect(cartao).toContain("const [aberto, setAberto] = useState(abrirAoInicio);");
    expect(cartao).toContain("aria-expanded={aberto}");
  });
});
