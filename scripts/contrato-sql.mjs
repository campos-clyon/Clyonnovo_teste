#!/usr/bin/env node
/**
 * Imprime a consulta que verifica o contrato do site contra a base.
 *
 *   npm run contrato:sql              → mostra o SQL
 *   npm run contrato:sql > c.sql      → guarda num ficheiro
 *
 * Cola o resultado no SQL editor do Supabase. O painel não tem credenciais
 * Supabase locais — este caminho não precisa de nenhuma, e é por isso que
 * funciona tanto aqui como no projecto do Bridge.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = pathToFileURL(join(raiz, "src", "lib", "contrato-dependencias.ts"));

// O Node 23+ retira os tipos sozinho, por isso importamos o .ts directamente
// em vez de manter uma cópia compilada que envelhece.
const { gerarSqlVerificacao } = await import(origem.href);
process.stdout.write(gerarSqlVerificacao());
