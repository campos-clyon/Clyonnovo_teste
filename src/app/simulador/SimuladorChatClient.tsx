"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, Image as ImageIcon, X, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderData } from "./types";
import { mergeOrderPatch, getMissingFields, isOrderComplete } from "./orderUtils";
import { extractVideoFrames } from "./videoFrames";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: { url: string; file: File }[];
  timestamp: Date;
  isHidden?: boolean;
  quickReplies?: string[];
};

type GeminiResponse = {
  assistantMessage: string;
  orderPatch?: Record<string, unknown>;
  nextQuestion?: string | null;
  quickReplies?: string[];
  shouldOpenContactForm?: boolean;
  shouldAskForPhotos?: boolean;
  status?: "collecting" | "ready_to_estimate" | "needs_photos" | "onsite_recommended";
  internalNotes?: string[];
  liveEstimate?: {
    minWithVat: number;
    maxWithVat: number;
    confidence: "high" | "medium" | "low";
    label: string;
  } | null;
  photoAnalysis?: {
    detectedItems: string[];
    materialNotes: string;
  } | null;
};

export default function SimuladorChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [orderData, setOrderData] = useState<OrderData>({});
  const [formData, setFormData] = useState({ nome: "", whatsapp: "", email: "", morada: "" });
  const [liveEstimate, setLiveEstimate] = useState<GeminiResponse["liveEstimate"]>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compressão de imagem
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxDim = 1024;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          }, "image/jpeg", 0.85);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Mensagem inicial da IA
  useEffect(() => {
    const initialMessage: Message = {
      id: "initial",
      role: "assistant",
      content:
        "Olá! Bem-vindo à Clyon. Que materiais precisa que a nossa equipa recolha hoje? Pode descrever ou enviar fotos do que tem aí.",
      timestamp: new Date(),
    };
    setMessages([initialMessage]);
  }, []);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    const compressedImages: { url: string; file: File }[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setError("Por favor, selecione ficheiros de imagem ou vídeo");
        continue;
      }

      // Videos are stored as-is (no compression) for server-side frame extraction
      if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        setImages((prev) => [...prev, { url, file }]);
        continue;
      }

      try {
        const compressedFile = await compressImage(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          setImages((prev) => [...prev, { url, file: compressedFile }]);
        };
        reader.readAsDataURL(compressedFile);
      } catch (err) {
        setError("Erro ao processar imagem");
      }
    }

    e.currentTarget.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!input.trim() && images.length === 0) {
      setError("Por favor, escreva uma mensagem ou adicione uma imagem");
      return;
    }

    setError("");

    // Adicionar mensagem do utilizador
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input || "(Imagem enviada)",
      images: images.length > 0 ? images : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setImages([]);
    setLoading(true);

    try {
      // Converter imagens e vídeos para base64
      type MimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const messageParts: Array<{ text: string } | { inlineData: { mimeType: MimeType; data: string } }> = [{ text: input }];

      for (const img of images) {
        if (img.file.type.startsWith("video/")) {
          // Extract key frames from video
          try {
            const frames = await extractVideoFrames(img.file, 4);
            for (const frame of frames) {
              messageParts.push({
                inlineData: {
                  mimeType: frame.mimeType as MimeType,
                  data: frame.base64,
                },
              });
            }
          } catch (err) {
            console.warn("[chat] Erro ao extrair frames do vídeo:", err);
          }
          continue;
        }

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(",")[1] || result;
            resolve(base64Data);
          };
          reader.readAsDataURL(img.file);
        });

        messageParts.push({
          inlineData: {
            mimeType: img.file.type as MimeType,
            data: base64,
          },
        });
      }

      // Converter histórico de mensagens para enviar à API
      const messagesForAPI = await Promise.all(
        messages
          .filter((msg) => !msg.isHidden)
          .map(async (msg) => {
            if (msg.role === "user" && msg.images) {
              const imageData = await Promise.all(
                msg.images.map(async (img) => {
                  const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = reader.result as string;
                      const base64Data = result.split(",")[1] || result;
                      resolve(base64Data);
                    };
                    reader.readAsDataURL(img.file);
                  });
                  return {
                    inlineData: {
                      mimeType: img.file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                      data: base64,
                    },
                  };
                })
              );
              return {
                role: msg.role,
                content: [{ text: msg.content }, ...imageData],
              };
            }
            return {
              role: msg.role,
              content: msg.content,
            };
          })
      );

      // Adicionar nova mensagem do utilizador
      messagesForAPI.push({
        role: "user",
        content: messageParts,
      });

      const response = await fetch("/api/chat-simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForAPI, order: orderData } as Record<string, unknown>),
      });

      const data: GeminiResponse = await response.json();

      if (!response.ok) {
        console.error("[chat] API error response:", data);
        const friendlyMsg =
          data.assistantMessage ||
          "Não consegui calcular a estimativa agora. Pode continuar a enviar os detalhes e a equipa CLYON confirma o valor.";
        throw new Error(friendlyMsg);
      }

      // Actualizar orderData com o patch extraído pelo Gemini
      if (data.orderPatch) {
        const patch = data.orderPatch as Partial<OrderData>;
        if (data.photoAnalysis?.detectedItems?.length && !patch.heavyItems?.length) {
          patch.heavyItems = data.photoAnalysis.detectedItems;
        }
        setOrderData((prev) => mergeOrderPatch(prev, patch));
      }

      // Actualizar estimativa em tempo real
      if (data.liveEstimate) {
        setLiveEstimate(data.liveEstimate);
      }

      // Preencher automaticamente formulário se Gemini extraiu dados de contacto
      if (data.orderPatch?.receiver) {
        const receiver = data.orderPatch.receiver as { name?: string; phone?: string; email?: string };
        setFormData((prev) => ({
          ...prev,
          nome: receiver.name || prev.nome,
          whatsapp: receiver.phone || prev.whatsapp,
          email: receiver.email || prev.email,
        }));
      }

      // Mostrar mensagem do assistente
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.assistantMessage,
        timestamp: new Date(),
        quickReplies: data.quickReplies,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Abrir formulário se Gemini indicou ou se completo
      if (data.shouldOpenContactForm || isOrderComplete({ ...orderData, ...data.orderPatch })) {
        setShowContactForm(true);
      }
    } catch (err) {
      console.error("[chat] Erro técnico:", err);
      setError(
        "Não consegui calcular a estimativa agora. Pode continuar a enviar os detalhes e a equipa CLYON confirma o valor."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForm = async () => {
    if (!formData.nome.trim() || !formData.whatsapp.trim() || !formData.morada.trim()) {
      setError("Por favor, preencha os campos obrigatórios");
      return;
    }

    setError("");
    setShowContactForm(false);
    setLoading(true);

    try {
      // Mensagem invisível com dados do formulário
      const invisibleMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: `O cliente forneceu os dados: Nome: ${formData.nome}, Contacto: ${formData.whatsapp}, Email: ${formData.email || "Não fornecido"}, Morada: ${formData.morada}. Por favor, processa esta informação e dá o teu orçamento final estimado em formato de intervalo de preço.`,
        timestamp: new Date(),
        isHidden: true,
      };

      setMessages((prev) => [...prev, invisibleMessage]);

      // Converter histórico (excluindo mensagens ocultas anteriores)
      const messagesForAPI = messages
        .filter((msg) => !msg.isHidden)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      // Adicionar mensagem invisível ao histórico
      messagesForAPI.push({
        role: "user",
        content: invisibleMessage.content,
      });

      const response = await fetch("/api/chat-simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForAPI }),
      });

      if (!response.ok) {
        throw new Error("Falha ao obter resposta");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao processar formulário"
      );
      console.error("Form error:", err);
      setShowContactForm(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/[0.02] px-6 py-4 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white">
            Simulador de Preços
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Chat com o orçamentista da Clyon
          </p>
        </div>
      </div>

      {/* Estimativa em tempo real */}
      {liveEstimate && (
        <div className="border-b border-white/10 bg-white/[0.02] px-6 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium",
              liveEstimate.confidence === "high"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : liveEstimate.confidence === "medium"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-500/20 text-slate-300 border border-slate-500/30"
            )}>
              <TrendingUp className="h-4 w-4" />
              <span>Estimativa: {liveEstimate.label}</span>
            </div>
            <span className="text-xs text-slate-500">
              {liveEstimate.confidence === "high" ? "Alta confiança" : liveEstimate.confidence === "medium" ? "Confiança média — mais dados melhoram" : "Estimativa preliminar"}
            </span>
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages
            .filter((msg) => !msg.isHidden)
            .map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-slate-500" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-2xl rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-blue-500/20 text-blue-100 border border-blue-400/30"
                      : "bg-slate-800/80 border border-slate-700/50 text-slate-100"
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>

                  {message.images && message.images.length > 0 && (
                    <div className="mt-3 grid gap-2 grid-cols-2">
                      {message.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img.url}
                          alt={`Imagem ${idx + 1}`}
                          className="rounded-lg max-h-48 object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-blue-600 border border-blue-500 flex items-center justify-center">
                    <div className="text-xs text-white font-semibold">U</div>
                  </div>
                )}
              </div>
            ))}

          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-slate-500" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                <span className="text-sm text-slate-400">A escrever...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input ou Formulário */}
      {!showContactForm ? (
        <div className="border-t border-white/10 bg-white/[0.02] px-6 py-6 backdrop-blur">
          <div className="max-w-4xl mx-auto">
            {error && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Preview de imagens */}
            {images.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-white/20">
                    <img
                      src={img.url}
                      alt={`Preview ${idx + 1}`}
                      className="h-20 w-20 object-cover"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input de mensagem */}
            <div className="flex gap-2">
              <div className="flex-1 flex gap-2 bg-white/[0.05] border border-white/10 rounded-full px-4 py-3 focus-within:border-blue-500/50 transition">
                <Input
                  type="text"
                  placeholder="Descreva o que precisa recolher..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  className="flex-1 bg-transparent border-0 focus-visible:ring-0 placeholder-slate-500 text-white"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleImageSelect}
                  disabled={loading}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="p-2 text-slate-400 hover:text-blue-400 transition disabled:opacity-50"
                  title="Carregar imagem"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={loading || (!input.trim() && images.length === 0)}
                className="rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Formulário de Contacto */
        <div className="border-t border-white/10 bg-white/[0.02] px-6 py-6 backdrop-blur">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Dados de Contacto</h3>

            {error && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Nome *</label>
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  disabled={loading}
                  className="bg-white/[0.05] border border-white/10 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 mb-2 block">WhatsApp/Telemóvel *</label>
                <Input
                  type="tel"
                  placeholder="Ex: +351 912 345 678"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  disabled={loading}
                  className="bg-white/[0.05] border border-white/10 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 mb-2 block">Email</label>
                <Input
                  type="email"
                  placeholder="Seu email (opcional)"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                  className="bg-white/[0.05] border border-white/10 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 mb-2 block">Morada *</label>
                <Input
                  type="text"
                  placeholder="Rua, número, código postal, cidade"
                  value={formData.morada}
                  onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                  disabled={loading}
                  className="bg-white/[0.05] border border-white/10 text-white placeholder-slate-500"
                />
              </div>

              <Button
                onClick={handleSubmitForm}
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    A processar...
                  </>
                ) : (
                  "Submeter"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
