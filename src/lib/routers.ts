import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./trpc-server";
import {
  getRegistrosHorasByColaborador,
  getAllColaboradores,
  getColaboradorByNome,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  createRegistroHoras,
  updateRegistroHoras,
  getTodayRegistroByColaborador,
} from "./db";
import { COOKIE_NAME } from "./auth";
import * as bcrypt from "bcryptjs";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(() => {
      // Cookie deletion is handled in the API route
      return { success: true } as const;
    }),
  }),

  historico: router({
    list: publicProcedure
      .input(
        z.object({
          colaboradorId: z.number(),
          page: z.number().default(1),
          limit: z.number().default(50),
        })
      )
      .query(async ({ input }) => {
        const offset = (input.page - 1) * input.limit;
        const registros = await getRegistrosHorasByColaborador(
          input.colaboradorId,
          input.limit,
          offset
        );
        return {
          registros,
          total: registros.length,
          page: input.page,
          limit: input.limit,
          totalPages: Math.ceil(registros.length / input.limit),
        };
      }),
  }),

  colaboradores: router({
    list: adminProcedure.query(async () => {
      return getAllColaboradores();
    }),

    create: adminProcedure
      .input(
        z.object({
          nome: z.string().min(2),
          senha: z.string().min(4),
          funcao: z.enum(["motorista", "ajudante", "admin"]),
          valorHora: z.string(),
          isAdmin: z.number().optional().default(0),
        })
      )
      .mutation(async ({ input }) => {
        const hashedSenha = await bcrypt.hash(input.senha, 10);
        await createColaborador({ ...input, senha: hashedSenha });
        return { success: true };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          nome: z.string().optional(),
          funcao: z.enum(["motorista", "ajudante", "admin"]).optional(),
          valorHora: z.string().optional(),
          isAdmin: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateColaborador(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteColaborador(input.id);
        return { success: true };
      }),
  }),

  ponto: router({
    login: publicProcedure
      .input(z.object({ nome: z.string(), senha: z.string() }))
      .mutation(async ({ input }) => {
        const colab = await getColaboradorByNome(input.nome);
        if (!colab) throw new Error("Colaborador não encontrado");
        const valid = await bcrypt.compare(input.senha, colab.senha);
        if (!valid) throw new Error("Senha incorreta");
        return {
          id: colab.id,
          nome: colab.nome,
          funcao: colab.funcao,
          valorHora: colab.valorHora,
          isAdmin: colab.isAdmin,
        };
      }),

    entrada: publicProcedure
      .input(
        z.object({
          colaboradorId: z.number(),
          horaEntrada: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        await createRegistroHoras({
          colaboradorId: input.colaboradorId,
          data: new Date(),
          horaEntrada: input.horaEntrada,
          numeroTrabalhos: 0,
          horasTrabalhadas: "0",
          valorTotal: "0",
        });
        return { success: true };
      }),

    pausa: publicProcedure
      .input(z.object({ colaboradorId: z.number(), horaPausa: z.string() }))
      .mutation(async ({ input }) => {
        const reg = await getTodayRegistroByColaborador(input.colaboradorId);
        if (!reg) throw new Error("Registo de hoje não encontrado");
        await updateRegistroHoras(reg.id, { horaPausa: input.horaPausa });
        return { success: true };
      }),

    saida: publicProcedure
      .input(
        z.object({
          colaboradorId: z.number(),
          horaSaida: z.string(),
          numeroTrabalhos: z.number(),
          horasTrabalhadas: z.string(),
          valorTotal: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const reg = await getTodayRegistroByColaborador(input.colaboradorId);
        if (!reg) throw new Error("Registo de hoje não encontrado");
        await updateRegistroHoras(reg.id, {
          horaSaida: input.horaSaida,
          numeroTrabalhos: input.numeroTrabalhos,
          horasTrabalhadas: input.horasTrabalhadas,
          valorTotal: input.valorTotal,
        });
        return { success: true };
      }),

    today: publicProcedure
      .input(z.object({ colaboradorId: z.number() }))
      .query(async ({ input }) => {
        return getTodayRegistroByColaborador(input.colaboradorId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
