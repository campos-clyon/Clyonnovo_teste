import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { camposExtraDoPedido } from "./campos-extra-do-pedido";
import { ENTRE_PARA_ENVIAR } from "./pedido-da-app-de-cliente";

/** S14 — conta para enviar pela app, e os campos novos na Mesa (29-10-2026). */
describe("S14", () => {
  it("a Mesa mostra os campos que o site e a app mandam", () => {
    const c = camposExtraDoPedido({
      origemPedido: "app_cliente",
      quantityExact: 12,
      entulhoQuantidadeEnsacados: "8",
      entulhoQuantidadePorEnsacar: 4,
      needsDismantling: true,
      originAccess: { accessNotes: "Escada estreita" },
      destinationAccess: { accessNotes: "Portão pequeno" },
      recurrenceFrequency: "quinzenal",
      autorizaFotos: true,
    });
    expect(c.map((x) => `${x.rotulo}: ${x.valor}`)).toEqual([
      "Origem: App de cliente",
      "Quantidade exacta: 12",
      "Sacos já cheios: 8",
      "Sacos por encher: 4",
      "Desmontagem: Sim, é preciso desmontar",
      "Notas do acesso (origem): Escada estreita",
      "Notas do acesso (destino): Portão pequeno",
      "Repetição: Quinzenal",
      "Fotografias: Autoriza mostrá-las no site e nas redes, sem nada que o identifique",
    ]);
    expect(camposExtraDoPedido(null)).toEqual([]);
    expect(camposExtraDoPedido({ quantityExact: -1, recurrenceFrequency: "diaria" })).toEqual([]);
  });

  it("pela app, sem sessão de cliente: 401 com o texto G3; o site continua a enviar sem conta", () => {
    const R = readFileSync(join(process.cwd(), "src/app/api/simulador/pedido/route.ts"), "utf8");
    expect(R).toMatch(
      /if \(order\.origemPedido === ORIGEM_DA_APP_DE_CLIENTE && !\(await emailDoCliente\(req\)\)\) \{\s+return NextResponse\.json\(\{ ok: false, error: ENTRE_PARA_ENVIAR \}, \{ status: 401 \}\);/,
    );
    expect(ENTRE_PARA_ENVIAR).toBe("Entre na CLYON para enviar o pedido.");
    // Com sessão, o email do pedido é o da sessão (vem antes do do formulário).
    expect(R).toMatch(/const contactEmail = sessionEmail \?\? formEmail;/);
  });
});
