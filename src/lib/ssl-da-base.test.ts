import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerCertificado, sslDaBase } from "./ssl-da-base";

/**
 * O TLS DA LIGAÇÃO AO MySQL — 01-10-2026, decisão do dono: «Vou buscar o
 * certificado». Com `MYSQL_CA_CERT` verifica-se o certificado; sem ela fica
 * exactamente como estava.
 */

const PEM = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBszCCAVmgAwIBAgIUQ2xZb25UZXN0ZUFwZW5hc1BhcmFPVGVzdGUwCgYIKoZI",
  "zj0EAwIwDzENMAsGA1UEAwwEdGVzdDAeFw0yNjEwMDEwMDAwMDBaFw0zNjEwMDEw",
  "-----END CERTIFICATE-----",
  "",
].join("\n");

afterEach(() => vi.restoreAllMocks());

describe("sem certificado, tudo como antes", () => {
  it("sem variável, ou vazia", () => {
    expect(sslDaBase(undefined)).toEqual({ rejectUnauthorized: false });
    expect(sslDaBase("")).toEqual({ rejectUnauthorized: false });
    expect(sslDaBase("   ")).toEqual({ rejectUnauthorized: false });
  });

  it("um valor que não é PEM não desliga a base — e diz-se", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(sslDaBase("isto não é um certificado")).toEqual({ rejectUnauthorized: false });
    expect(erro).toHaveBeenCalledOnce();
  });
});

describe("com certificado, verifica-se", () => {
  it("PEM com quebras de linha a sério", () => {
    expect(sslDaBase(PEM)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("PEM numa linha só, com as quebras escritas como barra-n", () => {
    const umaLinha = PEM.trimEnd().split("\n").join("\\n");
    expect(umaLinha).not.toContain("\n");
    expect(sslDaBase(umaLinha)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("CRLF, barra-r-barra-n escritos, e aspas à volta", () => {
    expect(lerCertificado(PEM.split("\n").join("\r\n"))).toBe(PEM);
    expect(lerCertificado(PEM.trimEnd().split("\n").join("\\r\\n"))).toBe(PEM);
    expect(lerCertificado(`"${PEM.trimEnd().split("\n").join("\\n")}"`)).toBe(PEM);
  });
});

describe("e é isto que a base usa", () => {
  it("as duas ligações de db.ts passam por sslDaBase", () => {
    const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    expect(db.match(/ssl: sslDaBase\(\)/g)?.length).toBe(2);
    expect(db).not.toContain("rejectUnauthorized");
  });
});
