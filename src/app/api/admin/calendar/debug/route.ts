import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

function normalizePrivateKey(raw?: string): string {
  if (!raw) throw new Error("GOOGLE_PRIVATE_KEY não configurada.");
  return raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "");
}

function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  if (!clientEmail) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL não configurado.");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

export async function GET(req: NextRequest) {
  // Auth — only admins/colaboradores may call this
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const configuredCalendarId = process.env.CLYON_GOOGLE_CALENDAR_ID ?? "(not set)";
  const serviceAccountEmail  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "(not set)";
  const privateKeyRaw        = process.env.GOOGLE_PRIVATE_KEY ?? "";
  const privateKeyOk         = privateKeyRaw.replace(/\\n/g, "\n").trim().startsWith("-----BEGIN");

  try {
    const calendar = getCalendarClient();

    // List all calendars the Service Account can see
    const listRes = await calendar.calendarList.list({ maxResults: 50 });
    const items = listRes.data.items ?? [];

    const calendars = items.map((c) => ({
      id:         c.id,
      summary:    c.summary,
      accessRole: c.accessRole,
    }));

    // Check if the configured ID is in the list
    const found = items.some(
      (c) =>
        c.id === configuredCalendarId ||
        c.summary?.toLowerCase().includes("clyon")
    );

    return NextResponse.json({
      ok: true,
      configuredCalendarId,
      serviceAccountEmail,
      privateKeyOk,
      calendarCount: calendars.length,
      configuredIdFoundInList: found,
      calendars,
    });
  } catch (err: any) {
    const msg: string = err?.errors?.[0]?.message ?? err?.message ?? String(err);
    return NextResponse.json(
      {
        ok: false,
        configuredCalendarId,
        serviceAccountEmail,
        privateKeyOk,
        error: msg,
      },
      { status: 500 }
    );
  }
}
