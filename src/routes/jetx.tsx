import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/store";
import { fmtBirr } from "@/lib/jetx";
import aviatorLogo from "@/assets/aviator-logo.png";
import bingoBanner from "@/assets/bingo-banner.png";
import aviatorBanner from "@/assets/aviator-banner.png";

export const Route = createFileRoute("/jetx")({ component: JetXPage });

// Spribe Aviator demo embed URL
const AVIATOR_URL =
  "https://aviator-demo.spribegaming.com/index.html" +
  "?currency=USD&operator=demo&jurisdiction=CW&lang=EN" +
  "&return_url=https%3A%2F%2Fspribe.co%2Fgames" +
  "&user=17853&token=vt6ZGOS440Z3McfEzR8bdGT7jEaxNaWe";

function JetXPage() {
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser> | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <div className="min-h-screen bg-background" suppressHydrationWarning />;
  }

  const balance = user?.balance ?? 0;

  return (
    <div
      className="min-h-screen text-foreground flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at top, oklch(0.16 0.03 250) 0%, oklch(0.08 0.01 250) 70%)",
      }}
    >
      <Toaster richColors position="top-center" />

      {/* Header — matches the rest of the app */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/40 border-b border-white/10 px-3 py-2 flex items-center gap-3">
        <img src={aviatorLogo} alt="Aviator" className="h-8 w-8 object-contain" />

        {/* Nav banners */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <Link
            to="/"
            className="rounded-md overflow-hidden border-2 border-white/10 hover:border-primary transition"
            title="Bingo"
            aria-label="Bingo"
          >
            <img src={bingoBanner} alt="Bingo" className="h-9 w-auto block" />
          </Link>
          <Link
            to="/jetx"
            className="rounded-md overflow-hidden border-2 border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]"
            title="Aviator"
            aria-label="Aviator"
          >
            <img src={aviatorBanner} alt="Aviator" className="h-9 w-auto block" />
          </Link>
        </div>

        {/* Balance */}
        <div className="text-sm text-right leading-tight">
          <div className="text-[10px] uppercase tracking-widest text-white/50">Balance</div>
          <div className="font-bold tabular-nums text-white">{fmtBirr(balance)}</div>
        </div>
      </header>

      {/* Full-screen Aviator iframe */}
      <main className="flex-1 flex flex-col">
        {!user ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-white">Aviator</h1>
              <p className="text-white/60">Please log in to play.</p>
              <Link to="/" className="text-primary underline">
                Go home
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full relative" style={{ minHeight: "calc(100vh - 56px)" }}>
            <iframe
              src={AVIATOR_URL}
              title="Aviator Game"
              allow="autoplay; fullscreen"
              className="absolute inset-0 w-full h-full border-0"
              style={{ display: "block" }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
