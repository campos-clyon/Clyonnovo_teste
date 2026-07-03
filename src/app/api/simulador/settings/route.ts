import { NextResponse } from "next/server";
import { getSimulatorSettings } from "@/lib/db";

export async function GET() {
  try {
    const settings = await getSimulatorSettings();
    return NextResponse.json({
      settings: settings.map((item) => ({
        key: item.key,
        label: item.label,
        category: item.category,
        unit: item.unit,
        value: item.value,
        description: item.description,
      })),
    });
  } catch (error) {
    console.error("[Simulador Settings] Failed to load settings", error);
    return NextResponse.json({ error: "Nao foi possivel carregar as configuracoes." }, { status: 500 });
  }
}
