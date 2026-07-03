"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { UploadedFile } from "../types";

interface UploadDropzoneProps {
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
  maxSizeMB?: number;
  maxFiles?: number;
}

export default function UploadDropzone({
  files,
  onAdd,
  onRemove,
  maxSizeMB = 10,
  maxFiles = 10,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (toAdd.length > 0) onAdd(toAdd);
  };

  const imageCount = files.filter((f) => f.type === "image").length;
  const videoCount = files.filter((f) => f.type === "video").length;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 cursor-pointer text-center transition-colors shadow-sm ${
          dragging
            ? "border-[#0487D9] bg-[#EFF8FF]"
            : "border-[#94A3B8] bg-white hover:border-[#0487D9] hover:bg-[#EFF8FF]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => processFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-1.5">
          <svg className="w-7 h-7 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-[#64748B]">
            Arraste ficheiros ou <span className="text-[#0487D9] font-medium">clique para selecionar</span>
          </p>
          <p className="text-xs text-[#94A3B8]">Fotos e vídeos — até {maxSizeMB} MB cada</p>
        </div>
      </div>

      {/* Status */}
      {files.length > 0 && (
        <p className="text-xs text-[#64748B]">
          {imageCount > 0 && `${imageCount} ${imageCount === 1 ? "imagem" : "imagens"}`}
          {imageCount > 0 && videoCount > 0 && " · "}
          {videoCount > 0 && `${videoCount} ${videoCount === 1 ? "vídeo" : "vídeos"}`}
          {" enviados"}
        </p>
      )}

      {/* Previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {files.map((f) => (
            <div key={f.id} className="relative group">
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9]">
                {(f.type === "image" || f.mimeType?.startsWith("image/")) && f.previewUrl ? (
                  <Image src={f.previewUrl} alt={f.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.68v6.641a1 1 0 01-1.447.894L15 14M4 8h11a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
                    </svg>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-[#E2E8F0] text-[#64748B] hover:text-red-500 hover:border-red-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                aria-label="Remover"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
