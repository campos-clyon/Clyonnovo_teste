import { describe, it, expect } from "vitest";
import { urlDeImagemPermitido } from "./url-externo-seguro";

/**
 * A rota de análise fazia fetch() ao que viesse no corpo do pedido, sem
 * autenticação a montante. Isto fecha a porta: só o nosso armazenamento.
 */
describe("urlDeImagemPermitido", () => {
  it("aceita o armazenamento de blobs da app", () => {
    expect(urlDeImagemPermitido("https://abc123.public.blob.vercel-storage.com/simulador/x.jpg")).not.toBeNull();
  });

  const recusados: Array<[string, string]> = [
    ["localhost", "https://localhost/x.png"],
    ["loopback", "https://127.0.0.1/x.png"],
    ["metadata da cloud", "http://169.254.169.254/latest/meta-data/"],
    ["rede interna", "http://10.0.0.5:8080/"],
    ["http em claro", "http://abc.public.blob.vercel-storage.com/x.jpg"],
    ["outro host qualquer", "https://exemplo-atacante.pt/x.png"],
    ["host que só CONTÉM o nosso", "https://blob.vercel-storage.com.atacante.pt/x.png"],
    ["porta não-443", "https://abc.public.blob.vercel-storage.com:8080/x.png"],
    ["credenciais embutidas", "https://u:p@abc.public.blob.vercel-storage.com/x.png"],
    ["file", "file:///etc/passwd"],
    ["blob do browser", "blob:https://clyon.pt/8f1e-4c2a"],
    ["texto solto", "nao-e-um-url"],
    ["vazio", ""],
  ];

  it.each(recusados)("recusa %s", (_nome, url) => {
    expect(urlDeImagemPermitido(url)).toBeNull();
  });
});
