export default function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-50/80 to-cyan-50/60" />
      <div className="absolute -left-[20%] -top-[30%] h-[70%] w-[60%] rounded-full bg-cyan-100/40 blur-3xl" />
      <div className="absolute -right-[10%] bottom-[10%] h-[50%] w-[45%] rounded-full bg-blue-100/30 blur-3xl" />
      <div className="absolute left-[40%] top-[20%] h-[40%] w-[30%] rounded-full bg-sky-100/25 blur-3xl" />
    </div>
  );
}
