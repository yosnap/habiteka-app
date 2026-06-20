const devLoginEnabled =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Habiteka</h1>
      <p className="text-muted-foreground max-w-md">
        Diseño, reformas e interiorismo inteligente. Setup inicial en marcha.
      </p>
      {devLoginEnabled && (
        <a
          href="/api/dev/login"
          className="bg-brand-500 mt-2 rounded-[var(--radius-control)] px-4 py-2 text-sm text-white"
        >
          Entrar como admin (modo desarrollo)
        </a>
      )}
    </main>
  );
}
