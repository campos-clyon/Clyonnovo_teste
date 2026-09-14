import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A FOTOGRAFIA DA VIATURA NÃO FICA NO BLOB DEPOIS DE JÁ NÃO SERVIR.
 *
 * O nome do ficheiro leva a hora — `viaturas/<id>-<agora>.jpg` — com
 * `addRandomSuffix: false`. Cada envio cria um ficheiro NOVO, que é o que evita
 * a cache no telemóvel, e nada apagava o anterior. Verificado a 14-09-2026:
 *
 *   · trocar a fotografia cinco vezes deixava cinco ficheiros públicos, e só o
 *     último com ponteiro na base — os outros sem ninguém saber que existiam;
 *   · tirá-la pelo perfil apagava só o ponteiro;
 *   · apagar a conta não limpava sequer a coluna.
 *
 * A matrícula está à vista na fotografia. São três portas para a mesma fuga, e
 * este ficheiro fecha as três.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ENVIO = ler("src/app/api/profissionais/foto-viatura/route.ts");
const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");

const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

describe("trocar a fotografia", () => {
  const trocar = corpoDe("trocarFotoDaViatura");

  it("lê a anterior e grava a nova na MESMA transacção", () => {
    // Em duas chamadas havia uma janela: dois envios ao mesmo tempo liam a
    // mesma antiga, apagavam-na duas vezes, e uma das novas ficava órfã na
    // mesma — que é justamente o que isto existe para impedir.
    expect(trocar).toContain("beginTransaction()");
    expect(trocar).toContain("FOR UPDATE");
    expect(trocar).toContain("UPDATE providers SET fotoViaturaUrl = ?");
    expect(trocar).toContain("conn.commit()");
  });

  it("devolve a anterior em vez de a apagar aqui dentro", () => {
    // Uma chamada ao Blob a meio da transacção prende a linha de `providers`
    // enquanto se espera pela internet.
    expect(trocar).not.toContain("apagarFotosDoBlob");
    expect(trocar).toContain("return antiga");
  });

  it("não apaga a fotografia que acabou de ficar no perfil", () => {
    expect(trocar).toContain("antiga !== novoUrl");
  });

  it("devolve a ligação ao pool mesmo quando estoira", () => {
    expect(trocar).toContain("conn.release()");
    expect(trocar).toContain("conn.rollback()");
  });
});

describe("a rota do envio", () => {
  it("passa pela troca, e não pelo UPDATE genérico", () => {
    // O genérico grava a coluna e não sabe qual era a de antes.
    expect(ENVIO).toContain("trocarFotoDaViatura(sessao.providerId, blob.url)");
    expect(ENVIO).not.toContain("actualizarPerfilDoProfissional");
  });

  it("apaga a anterior do Blob DEPOIS de a base já ter a nova", () => {
    // Ao contrário, ficava o perfil a apontar para um ficheiro apagado — uma
    // imagem partida no ecrã de quem o vê.
    const troca = ENVIO.indexOf("trocarFotoDaViatura(");
    const apaga = ENVIO.indexOf("apagarFotosDoBlob(");
    expect(troca).toBeGreaterThan(-1);
    expect(apaga).toBeGreaterThan(troca);
  });

  it("uma falha do Blob não estraga o envio — mas fica dita", () => {
    // A fotografia nova já está no perfil. Devolver erro por causa da velha
    // era dizer que falhou o que correu bem.
    expect(ENVIO).toContain("apagarFotosDoBlob([antiga]).catch(() => 0)");
    expect(ENVIO).toContain("console.error");
  });
});

describe("tirar a fotografia pelo perfil", () => {
  it("lê a anterior ANTES do UPDATE — depois já não há por onde saber", () => {
    const leitura = PERFIL.indexOf("urlDaFotoDaViatura(sessao.providerId)");
    const grava = PERFIL.indexOf("actualizarPerfilDoProfissional(sessao.providerId, mudancas)");
    expect(leitura).toBeGreaterThan(-1);
    expect(grava).toBeGreaterThan(leitura);
  });

  it("só quando a fotografia foi mesmo mexida", () => {
    // Guardar o IBAN não pode ir ler a fotografia, nem apagar coisa nenhuma.
    expect(PERFIL).toContain('"fotoViaturaUrl" in mudancas');
    expect(PERFIL).toContain("fotoAntiga !== mudancas.fotoViaturaUrl");
  });

  it("e apaga-a do Blob", () => {
    expect(PERFIL).toContain("apagarFotosDoBlob([fotoAntiga])");
  });

  it("o leitor traz só a coluna, e não a linha inteira", () => {
    // `perfilDoProfissional` traria trinta colunas — IBAN e morada fiscal
    // incluídos — para se ler um campo.
    const leitor = corpoDe("urlDaFotoDaViatura");
    expect(leitor).toContain("SELECT fotoViaturaUrl FROM providers");
    expect(leitor).not.toContain("SELECT *");
  });
});

describe("apagar a conta leva a fotografia", () => {
  const apagar = corpoDe("apagarProfissional");

  it("lê o endereço antes de a coluna ser limpa", () => {
    const leitura = apagar.indexOf("fotoViaturaUrl FROM providers");
    const limpeza = apagar.indexOf("fotoViaturaUrl = NULL");
    expect(leitura).toBeGreaterThan(-1);
    expect(limpeza).toBeGreaterThan(leitura);
  });

  it("apaga o ficheiro nos DOIS casos — anonimizada ou removida", () => {
    // O `if` é sobre haver fotografia, e não sobre o modo. Uma conta sem
    // passado é apagada com um DELETE e tinha exactamente o mesmo ficheiro.
    expect(apagar).toContain("if (p.fotoViaturaUrl)");
    const foto = apagar.indexOf("if (p.fotoViaturaUrl)");
    const temPassado = apagar.indexOf("if (temPassado)");
    expect(temPassado).toBeGreaterThan(-1);
    // Está fora do ramo do temPassado: vem depois de ele ter fechado, junto ao
    // fim da função.
    expect(foto).toBeGreaterThan(apagar.indexOf("conn.commit()"));
  });

  it("e diz se ficou lá", () => {
    expect(apagar).toContain("fotoDaViaturaApagada");
    expect(apagar).toContain("ficou no Blob");
  });
});
