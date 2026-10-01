import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, ensureProvidersSchema, actividadeDosProfissionais } from "@/lib/db";
import { ibanEncurtado } from "@/lib/iban";

export const runtime = "nodejs";

/**
 * Lista os profissionais do site para o painel, com a actividade de cada um.
 *
 * A actividade não é enfeite: sem ela não se distingue um profissional que
 * trabalha de um que recebe pedidos e nunca responde, ou de um que nunca
 * recebeu nada — e cada um desses casos pede uma acção diferente do
 * administrador. Vem de uma consulta agregada às negociações, e não de uma por
 * profissional.
 *
 * Devolve email, telefone, NIF e número de transportador, que são dados
 * pessoais e comerciais — daí exigir sessão de administrador.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    await ensureProvidersSchema();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ profissionais: [] });

    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, nif, city, categorias, zonas, raioKm,
              emiteFatura, regimeIva, emiteGuiaTransporte, numeroTransportador,
              guiaVerificadaEm, guiaVerificadaPor, estado, isActive,
              baseLat, baseLng, createdAt,
              moradaFiscal, codigoPostalFiscal, localidadeFiscal, tipoVeiculo,
              iban, ibanTitular, mbway,
              -- Se tem palavra-passe, e nunca qual: o hash não sai daqui.
              (passwordHash IS NOT NULL) AS temPalavraPasse
         FROM providers
        -- 'apagado' é a linha vazia que fica quando uma conta com história é
        -- apagada: as negociações antigas precisam dela, o painel não. Sem
        -- isto, "Profissional removido" ficava na lista para sempre.
        WHERE isClyon = 0 AND (estado IS NULL OR estado <> 'apagado')
        ORDER BY
          -- Quem espera verificação primeiro: é o que trava pedidos.
          (emiteGuiaTransporte = 1 AND guiaVerificadaEm IS NULL) DESC,
          (estado = 'pendente') DESC,
          createdAt DESC
        LIMIT 500`,
    ) as any[];

    const actividade = await actividadeDosProfissionais();

    const profissionais = (rows as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      /*
       * O IBAN sai ENCURTADO (`PT50 ···· 1234`), como no perfil que o próprio
       * vê. Esta lista vai inteira para o browser, com quinhentas linhas; o
       * «Editar perfil» só precisa de saber se há um, e para o mudar escreve-se
       * o novo — a máscara devolvida tal e qual é ignorada na gravação.
       */
      iban: typeof p.iban === "string" && p.iban ? ibanEncurtado(p.iban) : "",
      temPalavraPasse: Number(p.temPalavraPasse) === 1,
      actividade:
        actividade.get(Number(p.id)) ?? { recebidos: 0, comProposta: 0, fechados: 0 },
    }));

    return NextResponse.json({ profissionais });
  } catch (error) {
    console.error("[api/admin/profissionais GET]", error);
    return NextResponse.json({ error: "Erro ao listar profissionais" }, { status: 500 });
  }
}
