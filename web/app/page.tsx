import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import Image from "next/image";

import { AskBox } from "@/components/ask-box";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LIMITATIONS } from "@/lib/ask";

export const dynamic = "force-dynamic";

const DSPM_MOVIE = "seizure-dspm.mp4";
const SLORETA_MOVIE = "seizure-sloreta.mp4";

type Caption = { t?: number; method?: string; text?: string };
type Walkthrough = { status?: string; captions?: Caption[]; message?: string };

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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-20 px-6 py-16 sm:px-10">
      <section className="space-y-6">
        <div className="space-y-3">
          <Badge variant="outline">Public CHB-MIT recording</Badge>
          <h1 className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            NeuroSpread
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            I computed seizure-spread movies from one de-identified scalp EEG
            file. The frames come from dSPM and sLORETA on a template brain.
            This is a proof of concept, not a clinical tool.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>dSPM on the annotated seizure</CardTitle>
            <CardDescription>
              Public CHB-MIT seizure, template brain, not a patient-specific map.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                The dSPM movie is not here yet. From the repo root, run
                python -m pipeline to compute it from the source estimate.
                I will not put a generated brain in its place.
              </p>
            )}
          </CardContent>
        </Card>
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
          Each movie is a sequence of screenshots of that source estimate. No
          image-generation model is used.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>sLORETA, same window</CardTitle>
            <CardDescription>
              A second inverse method, not a second AI model.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
        <h2 className="text-2xl font-medium tracking-tight">Astra guide</h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          GPT-6 Astra writes from the computed stats JSON. It does not see
          the video, and it does not draw the map. This is not a diagnosis.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Walkthrough</CardTitle>
            <CardDescription>
              Written by GPT-6 Astra from computed stats, not from the video.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {captions.length > 0 ? (
              <ol className="space-y-3">
                {captions.map((caption, index) => (
                  <li key={`${caption.t}-${index}`} className="text-sm leading-relaxed">
                    <span className="text-accent">
                      {typeof caption.t === "number" ? `${caption.t}s` : "time unknown"}
                    </span>
                    {caption.method ? ` · ${caption.method}` : ""}
                    {caption.text ? ` · ${caption.text}` : ""}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Astra did not return captions for this run
                {walkthrough.message ? ` (${walkthrough.message})` : ""}.
                The movies still come from the source estimates. Rerun the
                pipeline with OPENAI_API_KEY set to fill this guide.
              </p>
            )}
            <AskBox liveQa={liveQa} />
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
              centimeters of uncertainty, not millimeters.
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
