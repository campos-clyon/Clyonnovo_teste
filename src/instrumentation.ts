/**
 * Next.js Instrumentation Hook — corre uma vez no arranque do servidor.
 * Usa-se para executar migrações de schema antes de qualquer request HTTP.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Fuso horário único do sistema — agendamentos, timestamps e "hoje"/"amanhã"
  // no motor de preços devem sempre referir-se à hora de Portugal, independentemente
  // do TZ do servidor onde o processo corre (ex: Vercel usa UTC por defeito).
  process.env.TZ = "Europe/Lisbon";

  // Só correr no Node.js (não no Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    /*
     * COM UMA SEGUNDA TENTATIVA QUANDO A LIGAÇÃO NÃO CHEGA — 26-10-2026 (d32, G).
     *
     * Nos registos da Vercel, o arranque do cron da purga (04:30, uma instância
     * nova) dava «migração de schema falhou: ETIMEDOUT» duas noites seguidas: a
     * primeira ligação ao MySQL do Railway, a frio, não chegou a tempo. A purga
     * corria na mesma — cada rota volta a pedir a migração —, mas o erro lia-se
     * como avaria. Uma falha de REDE (tempo esgotado, ligação cortada) tenta-se
     * mais duas vezes, com uma pausa; qualquer outro erro diz-se logo, como
     * antes.
     */
    try {
      const { comNovaTentativa } = await import("@/lib/nova-tentativa");
      const { ensureUsersSchema, ensureProvidersSchema } = await import("@/lib/db");
      await comNovaTentativa(async () => {
        await ensureUsersSchema();
        await ensureProvidersSchema();
      });
    } catch (err) {
      // Não bloquear o arranque se a migração falhar
      console.error("[instrumentation] migração de schema falhou:", err);
    }

    /*
     * AS MARCAÇÕES PARA UTC, ANTES DO PRIMEIRO PEDIDO — 01-10-2026.
     *
     * A ligação passou a ler a base em UTC; as marcações antigas estavam em
     * hora de Lisboa. Converte-se aqui, antes de o servidor responder a quem
     * quer que seja, e uma vez só — ver `fuso-da-base.ts`. Depois da primeira,
     * é uma leitura por arranque. Se falhar, não se arranca às escuras: fica
     * escrito, e o arranque seguinte tenta de novo.
     *
     * NUNCA DURANTE O BUILD: enquanto se constrói, quem responde ainda é o
     * site antigo, que lê a base à maneira antiga. Converter aí punha-o a
     * mostrar as marcações uma hora antes até a versão nova entrar.
     */
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      try {
        const { converterMarcacoesParaUtc } = await import("@/lib/fuso-da-base");
        const r = await converterMarcacoesParaUtc();
        if (r.estado === "feita") console.log("[instrumentation] marcações para UTC:", r.alteradas);
      } catch (err) {
        console.error("[instrumentation] conversão das marcações para UTC falhou:", err);
      }
    }
  }
}
