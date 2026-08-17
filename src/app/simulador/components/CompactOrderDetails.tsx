"use client";

import { useRef, useState } from "react";
import { X, Camera, ImagePlus, Check, AlertTriangle, Video } from "lucide-react";
import type { UploadedFile } from "../types";

/**
 * As fotografias e a descrição do pedido.
 *
 * As fotografias vêm PRIMEIRO, e a descrição depois. É a ordem certa e não uma
 * questão de gosto: sem fotografias o profissional está a adivinhar, e uma
 * proposta feita a adivinhar é a que se desfaz à porta do cliente — ele chega,
 * vê o que é de verdade, e o preço combinado deixa de fazer sentido. Com
 * fotografias o preço fecha e ninguém tem essa conversa.
 *
 * Estavam debaixo da descrição, num botão pequeno, com o mesmo peso visual de
 * um campo opcional. Passam a ter a área e o destaque do campo que são.
 *
 * A câmara e a galeria são dois botões separados de propósito. Num telemóvel
 * são gestos diferentes — tirar agora, ou escolher o que já lá está — e um
 * único botão "adicionar" obrigava a passar pelo menu do sistema para chegar
 * ao que se queria.
 */

interface CompactOrderDetailsProps {
  description?: string;
  files?: UploadedFile[];
  onDescriptionChange: (description: string) => void;
  onFilesAdd: (files: UploadedFile[]) => void;
  onFileRemove: (id: string) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export default function CompactOrderDetails({
  description,
  files = [],
  onDescriptionChange,
  onFilesAdd,
  onFileRemove,
  maxFiles = 10,
  maxSizeMB = 50,
}: CompactOrderDetailsProps) {
  const galeriaRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [aArrastar, setAArrastar] = useState(false);

  const processFiles = (raw: FileList | null) => {
    if (!raw) return;
    setError(null);
    const toAdd: UploadedFile[] = [];

    Array.from(raw).forEach((file) => {
      if (files.length + toAdd.length >= maxFiles) {
        setError(`Máximo de ${maxFiles} ficheiros.`);
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`"${file.name}" excede ${maxSizeMB} MB.`);
        return;
      }
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        setError(`"${file.name}" não é suportado.`);
        return;
      }
      toAdd.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        type: isImage ? "image" : "video",
        name: file.name,
        size: file.size,
      });
    });

    if (toAdd.length > 0) onFilesAdd(toAdd);
  };

  const semFotos = files.length === 0;
  const cheio = files.length >= maxFiles;

  return (
    <div className="space-y-4">
      {/* ── FOTOGRAFIAS ─────────────────────────────────────────────────── */}
      <div
        className={`rounded-xl border-2 bg-white p-5 transition-colors ${
          aArrastar ? "border-cyan-500 bg-cyan-50/50" : semFotos ? "border-cyan-200" : "border-slate-200"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setAArrastar(true);
        }}
        onDragLeave={() => setAArrastar(false)}
        onDrop={(e) => {
          e.preventDefault();
          setAArrastar(false);
          processFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Camera className="h-4 w-4 text-cyan-600" aria-hidden="true" />
              Fotografias
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
              É o que mais conta no preço. Com fotos os profissionais dão um valor a
              sério; sem fotos respondem por cima, para se protegerem.
            </p>
          </div>
          {!semFotos && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Check className="h-3 w-3" aria-hidden="true" />
              {files.length}
            </span>
          )}
        </div>

        <input
          ref={galeriaRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            processFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {/* `capture` faz o telemóvel abrir a câmara em vez do explorador. */}
        <input
          ref={camaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            processFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* O ícone vai dentro de um círculo cheio e não solto sobre o fundo.
            Num telemóvel, um traço fino de 1,5 px sobre fundo claro
            desaparece — e o que devia ser o botão mais óbvio do formulário
            passava a ser uma caixa com texto. */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={cheio}
            onClick={() => camaraRef.current?.click()}
            className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cyan-400 bg-cyan-50 px-3 py-4 transition active:scale-[0.98] hover:border-cyan-500 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 shadow-md shadow-cyan-600/25">
              <Camera className="h-6 w-6 text-white" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-sm font-bold text-cyan-900">Tirar foto</span>
          </button>
          <button
            type="button"
            disabled={cheio}
            onClick={() => galeriaRef.current?.click()}
            className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-400 bg-slate-50 px-3 py-4 transition active:scale-[0.98] hover:border-cyan-400 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 shadow-md shadow-slate-700/20">
              <ImagePlus className="h-6 w-6 text-white" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-sm font-bold text-slate-800">Da galeria</span>
          </button>
        </div>

        <p className="mt-2 hidden text-center text-xs text-slate-400 sm:block">
          ou arraste as fotografias para aqui · até {maxFiles} ficheiros
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">{error}</p>
        )}

        {/* Miniaturas */}
        {!semFotos && (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {files.map((file) => (
              <li key={file.id} className="relative">
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                  {file.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.previewUrl || ""}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <Video className="h-7 w-7" aria-hidden="true" />
                      <span className="mt-0.5 text-[10px]">Vídeo</span>
                    </div>
                  )}
                </div>
                {/*
                  Sempre visível. Estava com opacity-0 e group-hover, e num
                  telemóvel não há hover — era impossível remover uma foto
                  escolhida por engano.
                */}
                <button
                  type="button"
                  onClick={() => onFileRemove(file.id)}
                  aria-label={`Remover ${file.name}`}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900/80 p-1 text-white shadow-sm transition hover:bg-red-600"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* O aviso aparece só depois de a pessoa ter tido oportunidade de as
            juntar, e não bloqueia — há pedidos que genuinamente não têm o que
            fotografar. Mas diz-lhe o que perde. */}
        {semFotos && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-amber-800">
              Sem fotografias o pedido segue, mas a estimativa fica um intervalo largo
              e as propostas tendem a vir mais altas.
            </p>
          </div>
        )}
      </div>

      {/* ── DESCRIÇÃO ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label htmlFor="descricao-pedido" className="block text-sm font-semibold text-slate-900">
          Mais alguma coisa?{" "}
          <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <p className="mt-0.5 text-xs text-slate-600">
          O que as fotografias não mostram — acessos, andares, pressa.
        </p>
        <textarea
          id="descricao-pedido"
          value={description || ""}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Ex: móveis desmontados, alguns sacos, acesso por garagem..."
          className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          rows={3}
        />
      </div>
    </div>
  );
}
