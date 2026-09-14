import { existsSync, readFileSync } from "fs";
import path from "path";

import { CaseStudio } from "@/components/case-studio";
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
      <SiteHeader />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(45,212,191,0.18),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

        <section className="relative mx-auto max-w-6xl px-6 pb-8 pt-16 sm:px-10 sm:pt-24">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-teal-500/15 text-teal-100">Seizure source imaging</Badge>
            <Badge variant="outline">CHB-MIT · PhysioNet</Badge>
            <Badge variant="outline">{readyCount} live examples</Badge>
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl sm:leading-[1.05]">
            See how a seizure moves across the brain
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            NeuroSpread turns scalp EEG into an interactive 3D map. Compare{" "}
            <span className="text-foreground">dSPM</span> and{" "}
            <span className="text-foreground">sLORETA</span>, watch spread over time, click any
            region to ask what it means, and download a draft report — built for epileptologists,
            trainees, and families learning how source imaging works.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#explore"
              className="inline-flex items-center justify-center rounded-full bg-teal-400 px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-teal-300"
            >
              Browse example seizures
            </a>
            <a
              href="#upload"
              className="inline-flex items-center justify-center rounded-full border border-border/80 bg-card/50 px-6 py-3 text-sm font-medium text-foreground backdrop-blur transition hover:border-teal-500/40"
            >
              Upload your EEG
            </a>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <div className="grid gap-6 md:grid-cols-3">
            <Feature
              title="Propagation, not a snapshot"
              body="Scrub time and watch estimated activity spread on a template cortex — clearer than a static trace for teaching and rounds."
            />
            <Feature
              title="Two inverses, one recording"
              body="dSPM and sLORETA use the same data. When they disagree, the tool says so — that ambiguity is the point."
            />
            <Feature
              title="Draft reports faster"
              body="Export a structured localization note from computed peaks and spread order to speed up documentation (not a substitute for clinical read)."
            />
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <CaseStudio manifest={manifest} liveQa={liveQa} heroHasMovie={heroHasMovie} />
        </section>

        <section className="border-t border-border/60 bg-card/30">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight">Built for trust</h2>
            <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
              Public de-identified data and a standard head model (fsaverage). No patient MRI. No
              image-generation AI on the brain map — colors come from MNE source estimates. Not
              FDA-cleared; not for diagnosis or surgical planning without your own validation.
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
    <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
