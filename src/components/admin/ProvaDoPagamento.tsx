"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { exigeComprovativoAoRegistar, exigeContaDeDestino, type AlvoDoComprovativo } from "@/lib/origem-do-pagamento";
import { ACEITA_O_COMPROVATIVO, TAMANHO_MAXIMO_DO_COMPROVATIVO, MENSAGENS_DO_COMPROVATIVO } from "@/lib/comprovativo-do-pagamento";
import { rotuloDaConta, type ContaDeDestino } from "@/lib/contas-de-destino";
import { reduzirImagem } from "@/lib/reduzir-imagem";

/**
 * A PROVA DE UM PAGAMENTO REGISTADO À MÃO — d66 (CEO e dono, 18-11-2026).
 *
 * Juntar o comprovativo (foto ou PDF) a um registo, e o passo da prova no
 * «Já recebemos» e nas partes da cobrança: a conta onde a transferência
 * entrou (a lista das Configs) e o ficheiro. Só os Pagamentos importam isto
 * (a secção que pode juntar); a Mesa e as Finanças só vêem (RastoDoPagamento.tsx).
 */

/**
 * A FOTOGRAFIA REDUZIDA ANTES DE SUBIR. A Vercel recusa à entrada um pedido
 * com mais de 4,5 MB (ver `reduzir-imagem.ts`): uma fotografia de telemóvel a
 * 1920 px continua legível e fica em centenas de KB. Um PDF vai como está.
 */
export async function prepararComprovativo(f: File): Promise<File> {
  try {
    return (await reduzirImagem(f)).ficheiro;
  } catch {
    return f;
  }
}

/** O que dizer quando o envio é recusado à entrada (a Vercel, acima de 4,5 MB). */
export const GRANDE_DEMAIS_PARA_ENVIAR =
  "O ficheiro é grande demais para enviar daqui (acima de 4 MB). Junte uma fotografia ou um PDF mais leve.";

/** Junta um ficheiro a um registo que já existe. */
export function JuntarComprovativo({
  alvo,
  alvoId,
  onJunto,
}: {
  alvo: AlvoDoComprovativo;
  alvoId: number;
  onJunto?: () => void;
}) {
  const { token } = useAdminAuth();
  const entrada = useRef<HTMLInputElement>(null);
  const [aSubir, setASubir] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function subir(original: File) {
    if (!token) return;
    if (original.size > TAMANHO_MAXIMO_DO_COMPROVATIVO) {
      setAviso(MENSAGENS_DO_COMPROVATIVO.grande);
      return;
    }
    setASubir(true);
    setAviso(null);
    try {
      const f = await prepararComprovativo(original);
      const fd = new FormData();
      fd.set("alvo", alvo);
      fd.set("alvoId", String(alvoId));
      fd.set("file", f);
      const r = await fetch("/api/admin/pagamentos/comprovativos", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setAviso(r.status === 413 && !j.error ? GRANDE_DEMAIS_PARA_ENVIAR : (j.error ?? MENSAGENS_DO_COMPROVATIVO.falhou));
        return;
      }
      setAviso("Junto.");
      onJunto?.();
    } catch {
      setAviso("Erro de rede.");
    } finally {
      setASubir(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        ref={entrada}
        type="file"
        accept={ACEITA_O_COMPROVATIVO}
        className="hidden"
        aria-label="Comprovativo do pagamento"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void subir(f);
        }}
      />
      <button
        type="button"
        disabled={aSubir}
        onClick={() => entrada.current?.click()}
        className="inline-flex items-center gap-1 rounded border border-slate-600 px-1.5 py-0.5 text-[11px] text-slate-200 hover:border-cyan-500 hover:text-cyan-200 disabled:opacity-50"
      >
        {aSubir ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Upload className="h-3 w-3" aria-hidden="true" />}
        Juntar comprovativo
      </button>
      {aviso && <span className="text-[11px] text-slate-300">{aviso}</span>}
    </span>
  );
}

/** As contas de destino das Configs (para a transferência). */
export function useContasDeDestino(): ContaDeDestino[] {
  const { token } = useAdminAuth();
  const [contas, setContas] = useState<ContaDeDestino[]>([]);
  useEffect(() => {
    if (!token) return;
    let vivo = true;
    void fetch("/api/admin/contas-de-destino", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { contas: [] }))
      .then((j: { contas?: ContaDeDestino[] }) => {
        if (vivo) setContas(Array.isArray(j.contas) ? j.contas : []);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [token]);
  return contas;
}

/**
 * O QUE FALTA PARA REGISTAR À MÃO — a conta (numa transferência) e o
 * comprovativo. `obrigatorio`: o «Já recebemos» (transferência e numerário);
 * nas partes da cobrança junta-se se houver.
 */
export function CamposDaProva({
  metodo,
  contas,
  conta,
  onConta,
  ficheiro,
  onFicheiro,
  obrigatorio,
}: {
  metodo: string;
  contas: ContaDeDestino[];
  conta: string;
  onConta: (id: string) => void;
  ficheiro: File | null;
  onFicheiro: (f: File | null) => void;
  obrigatorio: boolean;
}) {
  const precisaConta = exigeContaDeDestino(metodo);
  const precisaFicheiro = obrigatorio && exigeComprovativoAoRegistar(metodo);
  return (
    <div className="mt-2 space-y-2">
      {(precisaConta || metodo === "pro_mbway" || metodo === "pro_numerario" || metodo === "numerario") && contas.length > 0 && (
        <label className="block text-[11px] text-slate-300">
          {precisaConta ? "Em que conta entrou" : "Em que conta entrou (se entrou numa)"}
          <select
            value={conta}
            onChange={(e) => onConta(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          >
            <option value="">{precisaConta ? "Escolha a conta" : "—"}</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {rotuloDaConta(c)}
              </option>
            ))}
          </select>
        </label>
      )}
      {precisaConta && contas.length === 0 && (
        <p className="text-[11px] text-amber-300">Ainda não há contas de destino nas Configs.</p>
      )}
      <label className="block text-[11px] text-slate-300">
        {precisaFicheiro ? "Comprovativo (obrigatório): fotografia ou PDF, até 10 MB" : "Comprovativo, se houver: fotografia ou PDF, até 10 MB"}
        <input
          type="file"
          accept={ACEITA_O_COMPROVATIVO}
          onChange={(e) => onFicheiro(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-[11px] text-slate-300 file:mr-2 file:rounded file:border file:border-slate-600 file:bg-slate-900 file:px-2 file:py-0.5 file:text-slate-200"
        />
      </label>
      {ficheiro && ficheiro.size > TAMANHO_MAXIMO_DO_COMPROVATIVO && (
        <p className="text-[11px] text-rose-300">{MENSAGENS_DO_COMPROVATIVO.grande}</p>
      )}
    </div>
  );
}

/** Pode gravar? A conta, se é transferência; o ficheiro, se é obrigatório. */
export function provaCompleta(metodo: string, conta: string, ficheiro: File | null, obrigatorio: boolean): boolean {
  if (exigeContaDeDestino(metodo) && !conta) return false;
  if (ficheiro && ficheiro.size > TAMANHO_MAXIMO_DO_COMPROVATIVO) return false;
  if (obrigatorio && exigeComprovativoAoRegistar(metodo) && !ficheiro) return false;
  return true;
}

/**
 * O PASSO DA PROVA NO «JÁ RECEBEMOS» — d66. Escolhido o método, a conta
 * (numa transferência) e o comprovativo; «Gravar» só acende com tudo o que é
 * obrigatório. O servidor confere o mesmo.
 */
export function FormularioDaProva({
  metodo,
  rotulo,
  ocupado,
  obrigatorio = true,
  onGravar,
  onCancelar,
}: {
  metodo: string;
  rotulo: string;
  ocupado: boolean;
  obrigatorio?: boolean;
  onGravar: (prova: { ficheiro: File | null; contaDeDestino: string }) => void;
  onCancelar: () => void;
}) {
  const contas = useContasDeDestino();
  const [conta, setConta] = useState("");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const pronto = provaCompleta(metodo, conta, ficheiro, obrigatorio);
  return (
    <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
      <p className="text-[11px] font-semibold text-amber-100">{rotulo}</p>
      <CamposDaProva
        metodo={metodo}
        contas={contas}
        conta={conta}
        onConta={setConta}
        ficheiro={ficheiro}
        onFicheiro={setFicheiro}
        obrigatorio={obrigatorio}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!pronto || ocupado}
          onClick={async () => onGravar({ ficheiro: ficheiro ? await prepararComprovativo(ficheiro) : null, contaDeDestino: conta })}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          Gravar
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Cancelar
        </button>
        {!pronto && (
          <span className="text-[11px] text-amber-200/80">
            {exigeContaDeDestino(metodo) && !conta ? "Escolha a conta. " : ""}
            {obrigatorio && exigeComprovativoAoRegistar(metodo) && !ficheiro ? "Junte o comprovativo." : ""}
          </span>
        )}
      </div>
    </div>
  );
}

