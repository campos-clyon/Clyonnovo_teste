/**
 * Exportação automática de pedidos concluídos para o Google Sheets
 * (CLYON_Plano_Mestre_Definitivo v3.0, secção 12 — rastreamento e rentabilidade).
 *
 * Reutiliza a mesma Service Account já configurada para o Google Calendar
 * (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY) — só precisa de acesso
 * de Editor à folha de cálculo alvo (partilhar a folha com esse email).
 *
 * Requer a variável GOOGLE_SHEETS_SPREADSHEET_ID. Se não estiver definida,
 * a exportação é ignorada silenciosamente (log de aviso) — nunca bloqueia
 * a conclusão do pedido.
 */
import { google } from "googleapis";
import { withConnection } from "@/lib/db";

// ─── Private key normalisation (mesma lógica de src/app/api/admin/pedidos/[id]/calendar/route.ts) ──
function normalizePrivateKey(raw?: string): string {
  if (!raw) throw new Error("GOOGLE_PRIVATE_KEY não configurada.");
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "");
}

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  if (!clientEmail) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL não configurado.");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

interface OrderRowSource {
  id: number;
  createdAt: Date | string;
  serviceType: string | null;
  city: string | null;
  estimateTotal: string | null;
  precoFinal: string | null;
  precoFinalIva: string | null;
  providerId: number | null;
}

/**
 * Exporta uma linha para o Google Sheets quando um pedido passa a "concluido".
 * Nunca lança exceção — apenas regista o erro, para nunca bloquear a conclusão
 * do pedido por causa de uma falha de integração externa.
 *
 * Nota: não existe ainda um campo de "Avaliação" ligado ao pedido (o sistema
 * de reviews atual não está associado a pedidos individuais) — a coluna fica
 * vazia até essa relação existir.
 */
export async function exportCompletedOrderToSheet(order: OrderRowSource): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.warn("[google-sheets] GOOGLE_SHEETS_SPREADSHEET_ID não configurado — export ignorado.");
    return;
  }

  try {
    let providerName = "";
    if (order.providerId) {
      providerName = await withConnection(async (conn) => {
        const [rows] = await conn.execute(
          "SELECT name FROM providers WHERE id = ? LIMIT 1",
          [order.providerId],
        ) as [Array<{ name: string }>, unknown];
        return rows[0]?.name ?? "";
      });
    }

    const sheets = getSheetsClient();
    const row = [
      order.id,
      new Date(order.createdAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }),
      order.serviceType ?? "",
      order.city ?? "",
      order.estimateTotal ?? "",
      order.precoFinalIva ?? order.precoFinal ?? "",
      providerName,
      new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }),
      "", // Avaliação — sem ligação pedido↔review ainda
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    console.log(`[google-sheets] Pedido #${order.id} exportado com sucesso.`);
  } catch (err) {
    console.error(`[google-sheets] Falha ao exportar pedido #${order.id}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * TIRAR O NOME DE UM PROFISSIONAL DA FOLHA.
 *
 * A folha guarda, por cada pedido concluído, o NOME de quem o fez (coluna G).
 * Nada voltava lá: nem a purga, nem o apagar da conta. O profissional apagava
 * a conta, a base ficava anonimizada — e o nome dele continuava numa folha
 * partilhada, ao lado de trabalhos, valores e localidades, para sempre.
 * Verificado a 15-09-2026.
 *
 * MATCHA-SE PELO NÚMERO DO PEDIDO, e não pelo nome. Dois profissionais podem
 * chamar-se o mesmo, e apagar a conta de um não pode levar o nome do outro. A
 * coluna A já tem o número do pedido, por isso não é preciso mexer na forma da
 * folha.
 *
 * NUNCA ATIRA. Quem chama está a acabar de apagar uma conta, e essa operação
 * não pode falhar por causa de uma folha de cálculo. O que não sair fica
 * escrito nos registos.
 */
export async function limparNomeDoProfissionalNaFolha(
  pedidoIds: number[],
  substituto = "Profissional removido",
): Promise<number> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId || pedidoIds.length === 0) return 0;

  try {
    const sheets = getSheetsClient();
    // Só a coluna A: é o número do pedido, e é tudo o que é preciso para
    // saber em que linha está cada um. Puxar a folha inteira era trazer os
    // valores todos para dentro do processo sem razão nenhuma.
    const leitura = await sheets.spreadsheets.values.get({ spreadsheetId, range: "A:A" });
    const linhas = leitura.data.values ?? [];
    const procurados = new Set(pedidoIds.map((n) => String(n)));

    const alteracoes: Array<{ range: string; values: string[][] }> = [];
    for (let i = 0; i < linhas.length; i += 1) {
      const idNaFolha = String(linhas[i]?.[0] ?? "").trim();
      if (!procurados.has(idNaFolha)) continue;
      // As linhas da folha contam a partir de 1.
      alteracoes.push({ range: `G${i + 1}`, values: [[substituto]] });
    }
    if (alteracoes.length === 0) return 0;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: alteracoes },
    });
    console.log(`[google-sheets] nome do profissional limpo em ${alteracoes.length} linha(s).`);
    return alteracoes.length;
  } catch (err) {
    console.error(
      "[google-sheets] não foi possível limpar o nome do profissional:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}
