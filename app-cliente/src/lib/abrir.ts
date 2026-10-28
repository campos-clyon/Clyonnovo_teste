import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { linkDeWhatsApp } from "../../../src/lib/link-de-whatsapp";
import { TELEFONE_DA_CLYON, WHATSAPP_DA_CLYON } from "../../../src/lib/telefone-da-clyon";
import { ORIGEM_DO_SITE } from "./links";

/**
 * ABRIR O QUE NÃO É DA APP — o WhatsApp da CLYON, o telefone e o WhatsApp do
 * profissional (só depois de contratado), e as páginas do site num navegador
 * dentro da app («Ver no navegador», Termos, «Como funciona»).
 *
 * O número da CLYON é o de `telefone-da-clyon.ts` — o mesmo do site, das
 * mensagens da Vitória e da app Pro. Nunca escrito aqui.
 */

export function whatsappDaClyon(texto?: string): void {
  const url = texto ? linkDeWhatsApp(TELEFONE_DA_CLYON, texto) ?? WHATSAPP_DA_CLYON : WHATSAPP_DA_CLYON;
  void Linking.openURL(url).catch(() => {});
}

export function ligarPara(telefone: string): void {
  void Linking.openURL(`tel:${telefone.replace(/[^\d+]/g, "")}`).catch(() => {});
}

export function whatsappPara(telefone: string, texto: string): void {
  const url = linkDeWhatsApp(telefone, texto);
  if (url) void Linking.openURL(url).catch(() => {});
}

/** Uma página do site num navegador dentro da app. Um link de pedido aberto aqui não volta a cair na app. */
export function abrirNoNavegador(caminhoOuEndereco: string): void {
  const url = caminhoOuEndereco.startsWith("https://") ? caminhoOuEndereco : `${ORIGEM_DO_SITE}${caminhoOuEndereco}`;
  void WebBrowser.openBrowserAsync(url).catch(() => {
    void Linking.openURL(url).catch(() => {});
  });
}
