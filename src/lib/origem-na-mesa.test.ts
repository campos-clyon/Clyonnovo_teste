import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { origemPeloSlug } from "./acesso";

/**
 * *«Os pedidos novos deviam mostrar a origem, ex: Wpp, Formulário, contacto,
 * Simulador.»* — 29-09-2026.
 *
 * Dois problemas no mesmo pedido: o bloco «Por enviar» não dizia a origem de
 * todo, e o resto da mesa tinha uma cópia própria do mapa SEM o WhatsApp — os
 * pedidos registados pelo assistente apareciam etiquetados «Simulador».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^\s*\/\/.*$/gm, "");

describe("as palavras de cada origem", () => {
  it("as que ele pediu: WhatsApp, formulário, contactos, simulador", () => {
    expect(origemPeloSlug("whatsapp").label).toBe("WhatsApp");
    expect(origemPeloSlug("hero_quote_form").label).toBe("Formulário");
    expect(origemPeloSlug("formulario_contactos").label).toBe("Contactos");
    expect(origemPeloSlug("simulador").label).toBe("Simulador");
  });

  it("sem origem gravada é do simulador — foi de lá que vieram os antigos", () => {
    expect(origemPeloSlug(null).label).toBe("Simulador");
    expect(origemPeloSlug("").label).toBe("Simulador");
  });

  it("uma origem nova mostra-se como veio, em vez de fingir que é do simulador", () => {
    expect(origemPeloSlug("instagram").label).toBe("instagram");
  });
});

describe("a mesa usa o mapa da casa, e mostra-o nos dois blocos", () => {
  const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

  it("já não tem uma cópia própria do mapa", () => {
    expect(MESA).not.toContain("const ORIGEM:");
    expect(MESA).toContain('import { origemPeloSlug } from "@/lib/acesso"');
  });

  it("a etiqueta aparece nos pedidos da mesa E nos por enviar", () => {
    const usos = MESA.match(/<EtiquetaDaOrigem slug=\{p\.origem\} \/>/g) ?? [];
    expect(usos.length).toBe(2);
  });

  it("a consulta dos por enviar traz a origem, pelas mesmas três chaves", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function pedidosPorPromover");
    const consulta = DB.slice(i, DB.indexOf("export async function promoverPedidoAPlataforma", i));
    for (const chave of ["$.origemPedido", "$._source", "$.source"]) {
      expect(consulta, chave).toContain(chave);
    }
    expect(consulta).toContain("AS origem");
  });
});
