"use client";

import { AccountPanel } from "@/components/AccountPanel";
import { LogoMark } from "@/components/Logo";
import { QuantumSafeScanner } from "@/components/QuantumSafeScanner";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <LogoMark size="md" />
            <div>
              <p className="text-sm font-semibold">QuantumSafeScan Lite</p>
              <p className="text-xs text-muted-foreground">GenLayer Builder Project</p>
            </div>
          </div>
          <AccountPanel />
        </div>
      </header>

      <main className="flex-grow px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <QuantumSafeScanner />
        </div>
      </main>

      <footer className="border-t border-white/10 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-5 px-4 text-sm text-muted-foreground md:px-6 lg:px-8">
          <a
            href="https://genlayer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            GenLayer
          </a>
          <a
            href="https://studio.genlayer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            Studio
          </a>
          <a
            href="https://docs.genlayer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            Docs
          </a>
          <a
            href="https://portal.genlayer.foundation/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            Portal
          </a>
        </div>
      </footer>
    </div>
  );
}
