import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import Image from "next/image";
import nextDynamic from "next/dynamic";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LIMITATIONS } from "@/lib/ask";

export const dynamic = "force-dynamic";

const BrainViewer = nextDynamic(
  () => import("@/components/brain-viewer").then((mod) => mod.BrainViewer),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">Loading interactive cortex…</p>
        </CardContent>
      </Card>
    ),
  }
);

const DSPM_MOVIE = "seizure-dspm.mp4";
const SLORETA_MOVIE = "seizure-sloreta.mp4";

type Caption = { t?: number; method?: string; text?: string };
type Walkthrough = { status?: string; source?: string; captions?: Caption[]; message?: string };

function publicPath(...parts: string[]) {
  return path.join(process.cwd(), "public", ...parts);
}

function publicExists(...parts: string[]) {
  return existsSync(publicPath(...parts));
}

function loadWalkthrough(): Walkthrough {
  if (!publicExists("astra-walkthrough.json")) {
    return { status: "missing", captions: [] };
  }
  return JSON.parse(readFileSync(publicPath("astra-walkthrough.json"), "utf8")) as Walkthrough;
}

function loadStills(): string[] {
  const dir = publicPath("stills");
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => `/stills/${name}`);
}

export default function Home() {
  const hasDspm = publicExists(DSPM_MOVIE);
  const hasSloreta = publicExists(SLORETA_MOVIE);
  const stills = loadStills();
  const walkthrough = loadWalkthrough();
  const captions = walkthrough.captions ?? [];
  const liveQa = Boolean(process.env.OPENAI_API_KEY);
  const hasBrain = publicExists("brain", "mesh.json");

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-20 px-6 py-16 sm:px-10">
      <section className="space-y-6">
        <div className="space-y-3">
          <Badge variant="outline">Public CHB-MIT recording</Badge>
          <h1 className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            NeuroSpread
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            I computed seizure spread on a template brain from one de-identified
            scalp EEG file. The interactive cortex is colored by dSPM and
            sLORETA source estimates. Captions and overlays come from those
            numbers. They do not draw the map. This is a proof of concept, not a
            clinical tool.
          </p>
        </div>
        <BrainViewer liveQa={liveQa} />
        {!hasBrain ? (
          <p className="text-sm text-muted-foreground">
            Public CHB-MIT seizure, template brain, not a patient-specific map.
          </p>
        ) : null}
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-medium tracking-tight">How it works</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          The pipeline downloads chb01_03.edf from PhysioNet, keeps the
          annotated window from 2996 to 3036 seconds, and filters at 1-40 Hz
          with a 60 Hz notch. Channels are mapped from CHB-MIT bipolar labels
          onto a standard 10-20 montage. That mapping is an approximation.
        </p>
        <p className="text-base leading-relaxed text-muted-foreground">
          There is no patient MRI, so the forward model uses fsaverage. The
          same window and head model are solved twice, as dSPM and as sLORETA.
          The 3D viewer and the movies below are both screenshots or meshes of
          that source estimate. No image-generation model is used.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Computed screenshot movies</CardTitle>
            <CardDescription>
              Offline MNE Brain screenshots for dSPM and sLORETA. Same data as
              the interactive cortex, fixed camera.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasDspm ? (
              <video
                className="w-full bg-black"
                src={`/${DSPM_MOVIE}`}
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                The dSPM movie is not here yet. Run python -m pipeline to
                compute it from the source estimate.
              </p>
            )}
            {hasSloreta ? (
              <video
                className="w-full bg-black"
                src={`/${SLORETA_MOVIE}`}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                The sLORETA movie is missing until the pipeline has been run.
              </p>
            )}
            {stills.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stills.map((src) => (
                  <Image
                    key={src}
                    src={src}
                    alt={`Still from the computed source estimate ${src}`}
                    width={1200}
                    height={800}
                    className="h-auto w-full bg-black"
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-medium tracking-tight">Disagreement probe</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          Captions on the cortex are computed from parcel JSON, not from a
          language model. Live Q&A, when the key is set, uses a cheap Chat
          Completions model and can seek or highlight those same parcels. Astra
          is a study subject for the disagreement prompt, not the runtime that
          draws overlays.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>What this week can claim</CardTitle>
            <CardDescription>
              Seven chb01 seizures, author-scored, no ground truth for which
              inverse is right.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              dSPM and sLORETA can peak in different parcels on the same window.
              That is ambiguity on a template inverse. The probe asks whether
              models admit that or invent a clean story. The protocol, rubric,
              and frozen prompt live in the study/ folder. Other CHB-MIT
              subjects and an expert rater are later work. The title has to
              match that evidence.
            </p>
            {walkthrough.source === "deterministic" && captions.length > 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Hero-case captions are also listed on the cortex above. They
                seek the playhead.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-medium tracking-tight">Who this is for</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          Neurologists and epileptologists usually see a static scan or a page
          of traces. Source-localized EEG can show spread over time. That is
          useful as a way to talk about surgical planning in principle. This
          build is public data, not that workflow.
        </p>
        <p className="text-base leading-relaxed text-muted-foreground">
          Engineers can inspect a real scientific pipeline here, not another
          chatbot demo. The visualization is traced to an inverse solution on
          a public recording.
        </p>
        <p className="text-base leading-relaxed text-muted-foreground">
          This does not replace clinical care. It cannot tell anyone where to
          resect, what to prescribe, or how to treat a patient.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-medium tracking-tight">Limitations</h2>
        <Card>
          <CardContent className="pt-1">
            <p className="text-base leading-relaxed text-muted-foreground">
              {LIMITATIONS} The head model is a template. The bipolar-to-10-20
              channel mapping is an approximation. Volume conduction leaves
              centimeters of uncertainty, not millimeters. The interactive
              cortex is fsaverage colored by the source estimate, not a
              patient-specific anatomy and not an Astra-generated picture.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3 pb-8">
        <h2 className="text-2xl font-medium tracking-tight">Links</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://github.com/anvoruganti/neurospread"
          >
            GitHub
          </a>
        </p>
        <p className="text-base leading-relaxed text-muted-foreground">
          Full write-up: Coming soon.
        </p>
      </section>
    </main>
  );
}
