export default function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50" />
      <div className="absolute -left-[15%] -top-[20%] h-[65%] w-[55%] rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="absolute -right-[5%] bottom-[5%] h-[55%] w-[45%] rounded-full bg-blue-200/25 blur-3xl" />
      <div className="absolute left-[35%] top-[15%] h-[45%] w-[35%] rounded-full bg-sky-200/20 blur-3xl" />
    </div>
  );
}
