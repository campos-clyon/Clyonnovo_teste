import Link from "next/link";

export default function HeroCTAButton() {
  return (
    <Link
      href="/simulador"
      className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-[#0891b2] px-6 text-sm font-semibold text-white shadow-lg shadow-cyan-600/25 transition-all hover:-translate-y-0.5 hover:bg-[#0e7490] hover:shadow-xl"
    >
      Pedir Orçamento Grátis
    </Link>
  );
}
