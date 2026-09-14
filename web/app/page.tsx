import { existsSync, readFileSync } from "fs";
import Image from "next/image";
import path from "path";

import { CaseStudio } from "@/components/case-studio";
import { NeuralBackdrop } from "@/components/neural-backdrop";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { CasesManifest, FALLBACK_MANIFEST } from "@/lib/cases";

export const dynamic = "force-dynamic";

function publicPath(...parts: string[]) {
  return path.join(process.cwd(), "public", ...parts);
}

function loadManifest(): CasesManifest {
  const manifestPath = publicPath("cases", "manifest.json");
  if (!existsSync(manifestPath)) {
    return FALLBACK_MANIFEST;
  }
  return JSON.parse(readFileSync(manifestPath, "utf8")) as CasesManifest;
}

export default function Home() {
  const manifest = loadManifest();
  const liveQa = Boolean(process.env.OPENAI_API_KEY);
  const heroHasMovie = existsSync(publicPath("seizure-dspm.mp4"));
  const readyCount = manifest.cases.filter((c) => c.ready).length;

  return (
    <>
      <NeuralBackdrop />
      <SiteHeader />
      <main className="relative">
        <section className="relative mx-auto max-w-6xl px-6 pb-10 pt-12 sm:px-10 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(200px,280px)]">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
                  For families & care teams
                </Badge>
                <Badge variant="outline" className="border-orange-400/20 text-orange-100/80">
                  {readyCount} real seizure examples
                </Badge>
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                Watch where a seizure travels on the brain
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Upload a hospital EEG or try a sample. We turn wires on the scalp into a 3D picture
                you can rotate, slide through time, and tap to ask simple questions — plus a written
                summary you can share with your doctor.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="rounded-full border border-cyan-500/25 px-3 py-1">
                  <strong className="text-cyan-100">Sharp peaks</strong> — strongest hot spots
                </span>
                <span className="rounded-full border border-orange-400/25 px-3 py-1">
                  <strong className="text-orange-100">Smooth spread</strong> — wider activity pattern
                </span>
              </div>
              <div className="mt-9 flex flex-wrap gap-4">
                <a
                  href="#explore"
                  className="inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-3 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                >
                  Try a sample seizure
                </a>
                <a
                  href="#upload"
                  className="inline-flex rounded-full border border-cyan-500/35 bg-black/40 px-6 py-3 text-sm font-medium text-cyan-50 backdrop-blur transition hover:border-cyan-400/60"
                >
                  Upload our EEG file
                </a>
              </div>
            </div>
            <div className="relative mx-auto hidden lg:block">
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-3xl" />
              <Image
                src="/neurospread-logo.png"
                alt=""
                width={280}
                height={280}
                className="relative rounded-2xl object-cover opacity-95 ring-1 ring-cyan-400/20"
                priority
              />
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-12 sm:px-10">
          <div className="grid gap-5 md:grid-cols-3">
            <Feature
              title="No jargon required"
              body="Two map styles — sharp vs smooth — help you see the same seizure in two ways without learning lab acronyms."
            />
            <Feature
              title="Follow the wave"
              body="Move the time slider to see how activity appears to move across the brain surface."
            />
            <Feature
              title="Questions welcome"
              body="Tap a region and ask what it means in everyday language. Export a draft summary for your neurology visit."
            />
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <CaseStudio manifest={manifest} liveQa={liveQa} heroHasMovie={heroHasMovie} />
        </section>

        <section className="border-t border-cyan-500/10 bg-black/40">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10">
            <h2 className="text-xl font-semibold">Please read this</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              NeuroSpread is an educational viewer on public or uploaded scalp EEG. It uses a generic
              brain shape, not your loved one&apos;s MRI. It does not diagnose epilepsy, pick surgery
              sites, or replace a neurologist. Always rely on your care team for treatment decisions.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-cyan-500/15 bg-[#060a14]/80 p-6 backdrop-blur-sm">
      <h3 className="text-base font-medium text-cyan-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
