import * as Device from "expo-device";
import { pedir, versaoDestaApp } from "./api";

/**
 * «ALGO NÃO FUNCIONA?» — 24-11-2026 (d108). A pessoa escreve o que aconteceu
 * e escolhe onde; vai com a versão da app, o modelo e o sistema do telemóvel
 * (`POST /api/cliente/algo-nao-funciona`). Com sessão, o site junta o email
 * da conta para a equipa responder. Aparece no backoffice em Contas ›
 * Programa da app.
 *
 * `ONDE_ACONTECEU` é a cópia da lista do site (`src/lib/sinais-da-app-de-cliente.ts`):
 * a app não importa esse ficheiro (o bundle só leva de src/lib os da lista do
 * workflow). O teste compara as duas.
 */

export const ROTA_DO_ALGO_NAO_FUNCIONA = "/api/cliente/algo-nao-funciona";
export const MINIMO_DO_PROBLEMA = 5;
export const MAXIMO_DO_PROBLEMA = 1000;

export const ONDE_ACONTECEU = [
  { id: "inicio", rotulo: "No Início" },
  { id: "pedir", rotulo: "Ao pedir um orçamento" },
  { id: "pedido", rotulo: "Num pedido ou numa proposta" },
  { id: "pagar", rotulo: "Ao pagar" },
  { id: "entrar", rotulo: "Ao entrar na conta" },
  { id: "avisos", rotulo: "Nos avisos" },
  { id: "outro", rotulo: "Outro sítio" },
] as const;

export type OndeAconteceu = (typeof ONDE_ACONTECEU)[number]["id"];

export const PROBLEMA_CURTO = "Conte-nos em poucas palavras o que aconteceu.";
export const PROBLEMA_RECEBIDO = "Obrigado! Recebemos a sua mensagem e a equipa da CLYON vai ver o que se passa.";

/** O modelo e o sistema, como o telemóvel os diz («Pixel 7», «Android 15»). */
export function oTelemovel(): { modelo: string | null; sistema: string | null } {
  const modelo = [Device.manufacturer, Device.modelName].filter(Boolean).join(" ").trim();
  const sistema = [Device.osName, Device.osVersion].filter(Boolean).join(" ").trim();
  return { modelo: modelo || null, sistema: sistema || null };
}

/** Envia; o erro (sem rede, a frase do site) sobe para o ecrã o mostrar. */
export async function enviarProblema(texto: string, onde: OndeAconteceu): Promise<void> {
  await pedir(ROTA_DO_ALGO_NAO_FUNCIONA, {
    metodo: "POST",
    corpo: { texto: texto.trim(), onde, versao: versaoDestaApp(), ...oTelemovel() },
  });
}
