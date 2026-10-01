/**
 * O TLS DA LIGAÇÃO AO MySQL — 01-10-2026.
 *
 * «Vou buscar o certificado» — decisão do dono, 01-10-2026.
 *
 * A ligação ao MySQL do Railway vai cifrada, mas com
 * `rejectUnauthorized: false`: aceita qualquer certificado, e por isso não
 * prova que do outro lado está a nossa base. Quem se pusesse no meio via as
 * credenciais e os dados todos.
 *
 * Isto prepara a troca sem a forçar:
 *
 *   · com `MYSQL_CA_CERT` (o PEM da autoridade que assinou o certificado do
 *     MySQL, tirado do painel do Railway), a ligação passa a verificar o
 *     certificado — `{ ca, rejectUnauthorized: true }`;
 *   · sem ela, fica EXACTAMENTE como estava — `{ rejectUnauthorized: false }`.
 *
 * O PEM chega de duas maneiras, e as duas servem: com quebras de linha a
 * sério (colado no painel da Vercel) ou numa linha só, com `\n` escritos
 * (colado num .env). Aspas à volta também se tiram.
 *
 * ⚠️ UM VALOR QUE NÃO É UM PEM NÃO DESLIGA A BASE. Se a variável existir mas
 * não tiver «-----BEGIN CERTIFICATE-----», regista-se o erro e mantém-se o
 * comportamento de antes: uma gralha numa variável não pode pôr o site
 * inteiro sem base de dados.
 *
 * ⚠️ O NOME DO SERVIDOR TAMBÉM É VERIFICADO. Com `rejectUnauthorized: true`,
 * o Node confere que o certificado foi passado para o nome a que se liga. O
 * certificado que o MySQL gera sozinho costuma ter um nome genérico, e o
 * endereço do Railway é outro (`*.proxy.rlwy.net`). Se a ligação falhar com
 * «Hostname/IP does not match certificate's altnames», o certificado não
 * serve tal como está. Experimentar primeiro numa pré-visualização.
 */

export type SslDaBase =
  | { rejectUnauthorized: false }
  | { ca: string; rejectUnauthorized: true };

/** O PEM limpo, ou `null` se não houver nada que se pareça com um. */
export function lerCertificado(valor: string | undefined | null): string | null {
  if (typeof valor !== "string") return null;
  let t = valor.trim();
  if (t === "") return null;

  // Aspas à volta, de quem colou `"-----BEGIN…"` num .env.
  if (t.length >= 2 && (t[0] === '"' || t[0] === "'") && t[t.length - 1] === t[0]) {
    t = t.slice(1, -1).trim();
  }

  // `\n` escritos (barra + n) passam a quebras de linha; CRLF passa a LF.
  const pem = t.replace(/\\r\\n|\\n/g, "\n").replace(/\r\n/g, "\n");

  if (!pem.includes("-----BEGIN CERTIFICATE-----")) return null;
  return pem.endsWith("\n") ? pem : `${pem}\n`;
}

/** O `ssl` a passar ao mysql2, a partir de `MYSQL_CA_CERT`. */
export function sslDaBase(valor: string | undefined = process.env.MYSQL_CA_CERT): SslDaBase {
  const ca = lerCertificado(valor);
  if (ca) return { ca, rejectUnauthorized: true };

  if (typeof valor === "string" && valor.trim() !== "") {
    console.error(
      "[ssl-da-base] MYSQL_CA_CERT existe mas não é um certificado PEM — ligação sem verificar, como antes.",
    );
  }
  return { rejectUnauthorized: false };
}
