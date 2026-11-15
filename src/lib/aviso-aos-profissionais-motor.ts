/**
 * O MOTOR DO AVISO A TODOS OS PROFISSIONAIS — d11 (15-11-2026).
 *
 * Decide o que sai em cada passagem, sem saber de SQL: recebe um repositório
 * (a base, em `aviso-aos-profissionais-na-base.ts`; nos testes, uma tabela em
 * memória) e as duas portas de saída (o Resend e a fila da ponte).
 *
 * Quem o põe a andar: cada ronda da ponte do WhatsApp (de 5 em 5 s, depois de
 * responder, com `after`) e a página do backoffice enquanto está aberta. Por
 * isso é seguro correr duas passagens ao mesmo tempo:
 *  - cada destinatário é RESERVADO antes de sair (pendente → a_enviar, uma
 *    só linha muda): quem não o reservou não o envia;
 *  - a vez do WhatsApp é um carimbo na linha do envio («o próximo pode sair a
 *    partir de…»), mudado por um UPDATE condicional: só uma passagem ganha a
 *    vez, e a seguinte espera 20 a 45 s;
 *  - um destinatário reservado que não chega a sair (a função morreu a meio)
 *    fica «a enviar» e NÃO volta a sair sozinho: mais vale um a menos do que
 *    dois iguais.
 */

import {
  dentroDaJanelaDoWhatsApp,
  intervaloAoAcaso,
  ESPERA_ENTRE_EMAILS_MS,
  type Canal,
  type ConteudoDoAviso,
} from "./aviso-aos-profissionais";

export type EnvioActivo = {
  id: number;
  canais: Canal[];
  conteudo: ConteudoDoAviso;
};

export type DestinatarioPorEnviar = { id: number; providerId: number; canal: Canal };

/** O contacto lido NO MOMENTO de enviar (não fica copiado na tabela do aviso). */
export type ContactoNoMomento = {
  nome: string | null;
  email: string | null;
  telemovel: string | null;
  /** Ainda aprovado, activo e sem ser de teste. */
  elegivel: boolean;
};

export interface RepositorioDoAviso {
  envioActivo(): Promise<EnvioActivo | null>;
  proximoPendente(envioId: number, canal: Canal): Promise<DestinatarioPorEnviar | null>;
  /** pendente → a_enviar. `true` só para quem mudou a linha. */
  reservar(destinatarioId: number): Promise<boolean>;
  /** a_enviar → pendente (o Resend pediu para esperar). */
  devolver(destinatarioId: number): Promise<void>;
  marcar(d: DestinatarioPorEnviar, estado: "enviado" | "falhou", motivo: string | null): Promise<void>;
  /** Ganha a vez do WhatsApp se o carimbo já passou, e põe o seguinte daqui a `segundos`. */
  ganharAVezDoWhatsApp(envioId: number, segundos: number): Promise<boolean>;
  /** Quantos ainda estão pendentes neste envio (os «a enviar» não contam). */
  pendentes(envioId: number): Promise<number>;
  terminar(envioId: number): Promise<void>;
  contacto(providerId: number): Promise<ContactoNoMomento | null>;
}

export type ResultadoDoEmail = "enviado" | "esperar" | { falhou: string };

export interface PortasDoAviso {
  enviarEmail(para: string, nome: string | null, conteudo: ConteudoDoAviso, providerId: number): Promise<ResultadoDoEmail>;
  /** `true` = posto na fila da ponte. */
  enviarWhatsApp(para: string, nome: string | null, conteudo: ConteudoDoAviso): Promise<boolean>;
  /** O WhatsApp está ligado no painel? Desligado, o WhatsApp espera (não falha). */
  whatsappPronto(): Promise<boolean>;
  esperar(ms: number): Promise<void>;
  aleatorio(): number;
}

export type ResultadoDaPassagem = {
  envioId: number | null;
  emails: number;
  whatsapps: number;
  falhas: number;
  foraDaJanela: boolean;
  terminado: boolean;
};

export async function avancarOAviso(
  repo: RepositorioDoAviso,
  portas: PortasDoAviso,
  agora: Date,
  opcoes: { maxEmails?: number } = {},
): Promise<ResultadoDaPassagem> {
  const r: ResultadoDaPassagem = { envioId: null, emails: 0, whatsapps: 0, falhas: 0, foraDaJanela: false, terminado: false };
  const envio = await repo.envioActivo();
  if (!envio) return r;
  r.envioId = envio.id;

  /* ── Email: um lote pequeno, um de cada vez ─────────────────────────────── */
  if (envio.canais.includes("email")) {
    const max = Math.max(0, Math.min(20, opcoes.maxEmails ?? 4));
    for (let i = 0; i < max; i++) {
      const d = await repo.proximoPendente(envio.id, "email");
      if (!d) break;
      if (!(await repo.reservar(d.id))) continue;
      const c = await repo.contacto(d.providerId);
      if (!c || !c.elegivel) {
        await repo.marcar(d, "falhou", "deixou de ser destinatário (não aprovado, inactivo ou de teste)");
        r.falhas++;
        continue;
      }
      if (!c.email) {
        await repo.marcar(d, "falhou", "sem email válido");
        r.falhas++;
        continue;
      }
      if (i > 0) await portas.esperar(ESPERA_ENTRE_EMAILS_MS);
      let res: ResultadoDoEmail;
      try {
        res = await portas.enviarEmail(c.email, c.nome, envio.conteudo, d.providerId);
      } catch (e) {
        res = { falhou: e instanceof Error ? e.message.slice(0, 180) : "erro ao enviar" };
      }
      if (res === "esperar") {
        await repo.devolver(d.id);
        break;
      }
      if (res === "enviado") {
        await repo.marcar(d, "enviado", null);
        r.emails++;
      } else {
        await repo.marcar(d, "falhou", res.falhou);
        r.falhas++;
      }
    }
  }

  /* ── WhatsApp: um por vez, 20–45 s entre cada, 9h–21h de Lisboa ──────────── */
  if (envio.canais.includes("whatsapp")) {
    if (!dentroDaJanelaDoWhatsApp(agora)) {
      r.foraDaJanela = true;
    } else if (await portas.whatsappPronto()) {
      const d = await repo.proximoPendente(envio.id, "whatsapp");
      if (d && (await repo.ganharAVezDoWhatsApp(envio.id, intervaloAoAcaso(portas.aleatorio())))) {
        if (await repo.reservar(d.id)) {
          const c = await repo.contacto(d.providerId);
          if (!c || !c.elegivel) {
            await repo.marcar(d, "falhou", "deixou de ser destinatário (não aprovado, inactivo ou de teste)");
            r.falhas++;
          } else if (!c.telemovel) {
            await repo.marcar(d, "falhou", "sem telemóvel válido para WhatsApp");
            r.falhas++;
          } else {
            let saiu = false;
            try {
              saiu = await portas.enviarWhatsApp(c.telemovel, c.nome, envio.conteudo);
            } catch {
              saiu = false;
            }
            if (saiu) {
              await repo.marcar(d, "enviado", null);
              r.whatsapps++;
            } else {
              await repo.marcar(d, "falhou", "o WhatsApp não aceitou (número bloqueado ou WhatsApp desligado)");
              r.falhas++;
            }
          }
        }
      }
    }
  }

  if ((await repo.pendentes(envio.id)) === 0) {
    await repo.terminar(envio.id);
    r.terminado = true;
  }
  return r;
}
