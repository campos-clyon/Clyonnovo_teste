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
    try {
      const { ensureUsersSchema, ensureProvidersSchema } = await import("@/lib/db");
      await ensureUsersSchema();
      await ensureProvidersSchema();
    } catch (err) {
      // Não bloquear o arranque se a migração falhar
      console.error("[instrumentation] migração de schema falhou:", err);
    }
  }
}
