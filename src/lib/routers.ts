import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./trpc-server";
import {
  getAllColaboradores,
  getColaboradorByNome,
  createColaborador,
  updateColaborador,
  deleteColaborador,
} from "./db";
import { COOKIE_NAME } from "./auth";
import * as bcrypt from "bcryptjs";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(() => {
      return { success: true } as const;
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
});

export type AppRouter = typeof appRouter;
