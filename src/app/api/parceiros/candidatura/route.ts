import { NextRequest, NextResponse } from "next/server";
import { TIPOS_DE_VEICULO } from "@/lib/convite-profissional";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import {
  CATEGORIAS_VALIDAS,
  emailValido,
  telefoneValido,
} from "@/lib/inscricao-profissional";
import { guardarCandidatura } from "@/lib/candidaturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Quem se oferece para trabalhar connosco, pelo site.
 *
 * É PÚBLICA e é a única escrita da plataforma que não exige sessão nem
 * convite — por isso leva limite por IP. O que ela cria não é um
 * profissional: é uma candidatura por tratar, que alguém no backoffice lê e
 * decide. Ninguém entra na fila de pedidos por aqui.
 *
 * O que se pede é o mínimo para poder decidir: nome, contacto, zona e o que
 * faz. Os dados a sério — NIF, morada fiscal, IBAN, raio — só depois do
 * convite, no formulário de inscrição. Pedir tudo à cabeça a um profissional
 * que ainda não sabe se quer é a forma mais rápida de o perder no terceiro
 * campo.
 */

/*
 * A LISTA E A DE `convite-profissional.ts`, desde 29-09-2026.
 *
 * Havia aqui uma copia com cinco entradas, e a canonica tem sete. O campo
 * deixou de ser uma etiqueta -- e ele que decide o valor por carga que o
 * profissional ve (`carga-da-carrinha.ts`) -- e duas listas a decidir
 * dinheiro nao dao erro no dia em que divergem: dao um preco.
 */
const VEICULOS: readonly string[] = TIPOS_DE_VEICULO.map((v) => v.id);

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export async function POST(req: NextRequest) {
  // Seis por hora do mesmo sítio: quem se candidata fá-lo uma vez.
  const limite = await limitarRotaPublica(req, "candidatura-parceiro", 6, 3600);
  if (limite.erro) return limite.erro;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const erros: Array<{ campo: string; mensagem: string }> = [];

  const nome = texto(corpo.nome, 120);
  if (!nome || nome.length < 2) {
    erros.push({ campo: "nome", mensagem: "Indique o seu nome ou o da empresa." });
  }

  const email = texto(corpo.email, 200)?.toLowerCase() ?? null;
  if (!email || !emailValido(email)) {
    erros.push({ campo: "email", mensagem: "Indique um email válido — é para lá que vai o convite." });
  }

  const telefone = texto(corpo.telefone, 30);
  if (!telefone || !telefoneValido(telefone)) {
    erros.push({ campo: "telefone", mensagem: "Indique um telemóvel português." });
  }

  const cidade = texto(corpo.cidade, 120);
  if (!cidade) {
    erros.push({ campo: "cidade", mensagem: "Diga de onde trabalha — é o que decide que pedidos lhe chegam." });
  }

  const servicosBrutos = Array.isArray(corpo.servicos) ? corpo.servicos : [];
  const servicos = servicosBrutos
    .filter((s): s is string => typeof s === "string")
    .filter((s) => CATEGORIAS_VALIDAS.includes(s));
  if (servicos.length === 0) {
    erros.push({ campo: "servicos", mensagem: "Escolha pelo menos um serviço que faça." });
  }

  const veiculoBruto = texto(corpo.tipoVeiculo, 60);
  const tipoVeiculo = veiculoBruto && VEICULOS.includes(veiculoBruto) ? veiculoBruto : null;

  if (erros.length > 0) {
    return NextResponse.json({ erros }, { status: 400 });
  }

  try {
    const { repetida } = await guardarCandidatura({
      nome: nome!,
      email: email!,
      telefone,
      cidade,
      tipoVeiculo,
      servicos,
      mensagem: texto(corpo.mensagem, 1000),
    });

    /*
     * A resposta é a mesma nos dois casos, de propósito.
     *
     * Dizer "já se tinha candidatado" a quem carregou duas vezes no botão não
     * ajuda ninguém e conta a quem sonda quais os emails que já cá estão.
     */
    return NextResponse.json({ ok: true, repetida });
  } catch (e) {
    console.error("[parceiros/candidatura]", e);
    return NextResponse.json(
      { error: "Não foi possível registar a candidatura. Tente outra vez daqui a pouco." },
      { status: 500 },
    );
  }
}
