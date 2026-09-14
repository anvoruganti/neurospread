import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-cyan-500/10 bg-[#02040a]/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 sm:px-10">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-tight">
          <Image
            src="/neurospread-logo.png"
            alt="NeuroSpread"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover ring-1 ring-cyan-400/30"
            priority
          />
          <span className="bg-gradient-to-r from-cyan-100 to-sky-200 bg-clip-text text-transparent">
            NeuroSpread
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
          <a href="#explore" className="transition hover:text-cyan-100">Examples</a>
          <a href="#upload" className="transition hover:text-cyan-100">Your EEG</a>
          <a
            href="https://github.com/anvoruganti/neurospread"
            className="transition hover:text-cyan-100"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
