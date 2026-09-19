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

describe("gravar as fotografias", () => {
  /*
   * ERA `trocarFotoDaViatura`, e trocava UMA — 19-09-2026, quando as viaturas
   * passaram a ser várias: "vamos colocar a opção deles colocarem fotos dos
   * veículos". As promessas são as mesmas, sobre uma lista em vez de um campo.
   */
  const guardar = corpoDe("guardarFotosDaViatura");

  it("lê as anteriores e grava as novas na MESMA transacção", () => {
    // Em duas chamadas havia uma janela: dois envios ao mesmo tempo liam a
    // mesma lista, e um deles perdia-se — ou ficava órfão no Blob.
    expect(guardar).toContain("beginTransaction()");
    expect(guardar).toContain("FOR UPDATE");
    expect(guardar).toContain("UPDATE providers SET fotosViaturaJson = ?, fotoViaturaUrl = ?");
    expect(guardar).toContain("conn.commit()");
  });

  it("mantém a coluna antiga a apontar para a PRIMEIRA da lista", () => {
    /*
     * `fotoViaturaUrl` não desapareceu: meia dúzia de sítios lêem-na — o
     * cartão do perfil, a ficha no backoffice, a anonimização. Duas colunas a
     * dizer a mesma coisa só se aguentam com um sítio só a escrevê-las, e é
     * este.
     */
    expect(guardar).toContain("fotos[0] ?? null");
  });

  it("devolve as órfãs em vez de as apagar aqui dentro", () => {
    // Uma chamada ao Blob a meio da transacção prende a linha de `providers`
    // enquanto se espera pela internet.
    expect(guardar).not.toContain("apagarFotosDoBlob");
    expect(guardar).toContain("orfas: antes.filter((u) => !fotos.includes(u))");
  });

  it("não apaga as que ficaram no perfil", () => {
    // É o que o `!fotos.includes(u)` faz: órfã é a que já não está na lista.
    expect(guardar).toContain("!fotos.includes(u)");
  });

  it("devolve a ligação ao pool mesmo quando estoira", () => {
    expect(guardar).toContain("conn.release()");
    expect(guardar).toContain("conn.rollback()");
  });
});

describe("a rota do envio", () => {
  it("passa pela gravação da lista, e não pelo UPDATE genérico", () => {
    // O genérico grava a coluna e não sabe quais eram as de antes.
    expect(ENVIO).toContain("guardarFotosDaViatura(sessao.providerId, [");
    expect(ENVIO).not.toContain("actualizarPerfilDoProfissional");
  });

  it("ACRESCENTA à lista, e não substitui", () => {
    // "Vamos colocar a opção deles colocarem fotos dos veículos." Substituir
    // era o que ela fazia antes — e o que o obrigava a escolher entre a
    // carrinha e o camião.
    expect(ENVIO).toContain("...jaTem,");
    expect(ENVIO).toContain("blob.url,");
  });

  it("e recusa a que passa do limite ANTES de a subir", () => {
    /*
     * Depois de subir, recusar deixava o ficheiro no Blob sem ponteiro nenhum
     * na base — público, e sem ninguém saber que existe.
     */
    const limite = ENVIO.indexOf("MAX_FOTOS_DA_VIATURA");
    const sobe = ENVIO.indexOf("await put(");
    expect(limite).toBeGreaterThan(-1);
    expect(sobe).toBeGreaterThan(limite);
  });

  it("apaga as órfãs do Blob DEPOIS de a base já ter a lista nova", () => {
    // Ao contrário, ficava o perfil a apontar para um ficheiro apagado — uma
    // imagem partida no ecrã de quem o vê.
    const grava = ENVIO.indexOf("guardarFotosDaViatura(");
    const apaga = ENVIO.indexOf("apagarFotosDoBlob(orfas)");
    expect(grava).toBeGreaterThan(-1);
    expect(apaga).toBeGreaterThan(grava);
  });

  it("uma falha do Blob não estraga o envio — mas fica dita", () => {
    // A fotografia nova já está no perfil. Devolver erro por causa da velha
    // era dizer que falhou o que correu bem.
    expect(ENVIO).toContain("apagarFotosDoBlob(orfas).catch(() => 0)");
    expect(ENVIO).toContain("console.error");
  });

  it("e há por onde tirar uma sem mexer nas outras", () => {
    /*
     * Enquanto era uma só, trocar era apagar. Com várias, ele tem de poder
     * remover a que ficou tremida — e o ficheiro tem de sair do Blob, que é
     * onde está a matrícula.
     */
    expect(ENVIO).toContain("export async function DELETE(");
    const del = ENVIO.slice(ENVIO.indexOf("export async function DELETE("));
    expect(del).toContain("guardarFotosDaViatura(");
    expect(del).toContain("apagarFotosDoBlob(orfas)");
    // E só as dele: o que não estiver na lista dele não tira nada a ninguém.
    expect(del).toContain("antes.includes(url)");
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

  it("lê os endereços antes de as colunas serem limpas", () => {
    const leitura = apagar.indexOf("fotosViaturaJson FROM providers");
    const limpeza = apagar.indexOf("fotoViaturaUrl = NULL");
    expect(leitura).toBeGreaterThan(-1);
    expect(limpeza).toBeGreaterThan(leitura);
  });

  it("apaga TODAS, e não só a primeira", () => {
    /*
     * 19-09-2026, quando as viaturas passaram a ser várias. Limpar a coluna
     * antiga e deixar as outras cinco no Blob era fazer metade do trabalho e
     * ficar com a consciência tranquila — com cinco matrículas públicas.
     */
    expect(apagar).toContain("lerFotos(p.fotosViaturaJson, p.fotoViaturaUrl)");
    expect(apagar).toContain("apagarFotosDoBlob(fotosDeleteViatura)");
  });

  it("apaga o ficheiro nos DOIS casos — anonimizada ou removida", () => {
    // O `if` é sobre haver fotografias, e não sobre o modo. Uma conta sem
    // passado é apagada com um DELETE e tinha exactamente os mesmos ficheiros.
    expect(apagar).toContain("if (fotosDeleteViatura.length > 0)");
    const foto = apagar.indexOf("if (fotosDeleteViatura.length > 0)");
    const temPassado = apagar.indexOf("if (temPassado)");
    expect(temPassado).toBeGreaterThan(-1);
    // Está fora do ramo do temPassado: vem depois de ele ter fechado, junto ao
    // fim da função.
    expect(foto).toBeGreaterThan(apagar.indexOf("conn.commit()"));
  });

  it("e diz quantas ficaram lá", () => {
    expect(apagar).toContain("fotoDaViaturaApagada");
    expect(apagar).toContain("ficaram no Blob");
  });
});
