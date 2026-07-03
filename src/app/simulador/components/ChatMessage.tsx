"use client";

import Image from "next/image";
import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#0487D9] to-[#19C2E6] flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <div className="flex flex-col gap-1 max-w-[80%]">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <p className="text-[#102033] text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-xs text-[#94A3B8] ml-1">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-end gap-3">
      <div className="flex flex-col items-end gap-1 max-w-[80%]">
        {/* Imagens enviadas */}
        {message.files && message.files.length > 0 && (
          <div className={`grid gap-1.5 ${message.files.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {message.files.map((f) =>
              (f.type === "image" || f.mimeType?.startsWith("image/")) && f.previewUrl ? (
                <div key={f.id} className="relative w-28 h-28 rounded-xl overflow-hidden border border-[#E2E8F0]">
                  <Image src={f.previewUrl} alt={f.name} fill className="object-cover" />
                </div>
              ) : (
                <div key={f.id} className="w-28 h-28 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex flex-col items-center justify-center gap-1">
                  <svg className="w-6 h-6 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.68v6.641a1 1 0 01-1.447.894L15 14M4 8h11a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
                  </svg>
                  <span className="text-[10px] text-[#64748B] text-center px-1 truncate w-full text-center">{f.name}</span>
                </div>
              )
            )}
            {message.files.length > 1 && (
              <span className="text-xs text-[#94A3B8] text-right mt-0.5">
                {message.files.length} {message.files.length === 1 ? "ficheiro" : "ficheiros"} enviados
              </span>
            )}
          </div>
        )}
        {message.content && (
          <div className="bg-[#0487D9] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
            <p className="text-white text-sm leading-relaxed">{message.content}</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#94A3B8]">{formatTime(message.timestamp)}</span>
          <svg className="w-3.5 h-3.5 text-[#0487D9]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0487D9] flex items-center justify-center shadow-sm">
        <span className="text-white text-xs font-bold">U</span>
      </div>
    </div>
  );
}
