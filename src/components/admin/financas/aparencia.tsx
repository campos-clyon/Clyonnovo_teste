import {
  Banknote,
  Car,
  ClipboardList,
  CreditCard,
  Fuel,
  Gift,
  GraduationCap,
  HardHat,
  HeartPulse,
  Home,
  Landmark,
  Megaphone,
  Milestone,
  MoreHorizontal,
  Package,
  Percent,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Truck,
  UserCheck,
  Users,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Cor, Icone } from "@/lib/financas";

/**
 * COMO SE VÊ UMA CATEGORIA NA GESTORA — a cor e o ícone.
 *
 * As cores são os dez tons da paleta do dono (`globals.css`), no modo do
 * backoffice escuro: o tom cheio para o ponto e o traço, o tom a 15 % para o
 * fundo, e o `-texto` para as letras. Escritas por extenso porque o Tailwind
 * só gera as classes que encontra escritas.
 */
export const CLASSES_DA_COR: Record<Cor, { ponto: string; chip: string; traco: string; anel: string }> = {
  ciano: { ponto: "bg-ciano", chip: "bg-ciano/15 text-ciano-texto", traco: "stroke-ciano", anel: "ring-ciano" },
  azul: { ponto: "bg-azul", chip: "bg-azul/15 text-azul-texto", traco: "stroke-azul", anel: "ring-azul" },
  violeta: { ponto: "bg-violeta", chip: "bg-violeta/15 text-violeta-texto", traco: "stroke-violeta", anel: "ring-violeta" },
  magenta: { ponto: "bg-magenta", chip: "bg-magenta/15 text-magenta-texto", traco: "stroke-magenta", anel: "ring-magenta" },
  coral: { ponto: "bg-coral", chip: "bg-coral/15 text-coral-texto", traco: "stroke-coral", anel: "ring-coral" },
  laranja: { ponto: "bg-laranja", chip: "bg-laranja/15 text-laranja-texto", traco: "stroke-laranja", anel: "ring-laranja" },
  ambar: { ponto: "bg-ambar", chip: "bg-ambar/15 text-ambar-texto", traco: "stroke-ambar", anel: "ring-ambar" },
  lima: { ponto: "bg-lima", chip: "bg-lima/15 text-lima-texto", traco: "stroke-lima", anel: "ring-lima" },
  esmeralda: { ponto: "bg-esmeralda", chip: "bg-esmeralda/15 text-esmeralda-texto", traco: "stroke-esmeralda", anel: "ring-esmeralda" },
  ardosia: { ponto: "bg-ardosia", chip: "bg-ardosia/15 text-ardosia-texto", traco: "stroke-ardosia", anel: "ring-ardosia" },
};

export const NOME_DA_COR: Record<Cor, string> = {
  ciano: "Ciano",
  azul: "Azul",
  violeta: "Violeta",
  magenta: "Magenta",
  coral: "Coral",
  laranja: "Laranja",
  ambar: "Âmbar",
  lima: "Lima",
  esmeralda: "Esmeralda",
  ardosia: "Ardósia",
};

export const DESENHO_DO_ICONE: Record<Icone, LucideIcon> = {
  salario: Users,
  combustivel: Fuel,
  portagem: Milestone,
  alimentacao: Utensils,
  mecanica: Wrench,
  viatura: Car,
  compras: ShoppingCart,
  material: Package,
  servicos: ClipboardList,
  assinatura: Repeat,
  impostos: Receipt,
  renda: Home,
  publicidade: Megaphone,
  seguro: ShieldCheck,
  telefone: Smartphone,
  saude: HeartPulse,
  formacao: GraduationCap,
  trabalho: Truck,
  clientes: UserCheck,
  profissionais: HardHat,
  comissao: Percent,
  banco: Landmark,
  presente: Gift,
  outros: MoreHorizontal,
};

/** O ícone numa bolinha da cor da categoria. */
export function BolaDaCategoria({ cor, icone, grande = false }: { cor: Cor; icone: Icone; grande?: boolean }) {
  const Desenho = DESENHO_DO_ICONE[icone] ?? MoreHorizontal;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${CLASSES_DA_COR[cor].chip} ${
        grande ? "h-10 w-10" : "h-7 w-7"
      }`}
    >
      <Desenho className={grande ? "h-5 w-5" : "h-3.5 w-3.5"} />
    </span>
  );
}

/** O ícone de uma conta, pelo tipo. */
export function DesenhoDaConta({ tipo, className }: { tipo: string; className?: string }) {
  const Desenho = tipo === "dinheiro" ? Banknote : tipo === "cartao" ? CreditCard : Landmark;
  return <Desenho className={className} aria-hidden="true" />;
}
