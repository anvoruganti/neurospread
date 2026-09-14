"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import nextDynamic from "next/dynamic";

import { UploadSection } from "@/components/upload-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CaseManifestEntry,
  CasesManifest,
  FALLBACK_MANIFEST,
} from "@/lib/cases";

const BrainViewer = nextDynamic(
  () => import("@/components/brain-viewer").then((mod) => mod.BrainViewer),
  {
    ssr: false,
    loading: () => (
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading 3D cortex…
        </CardContent>
      </Card>
    ),
  }
);

type CaseStudioProps = {
  manifest: CasesManifest;
  liveQa: boolean;
  heroHasMovie: boolean;
};

function prettyPeak(label?: string) {
  if (!label) return "—";
  return label.replace(/-/g, " ");
}

export function CaseStudio({ manifest, liveQa, heroHasMovie }: CaseStudioProps) {
  const [customCases, setCustomCases] = useState<CaseManifestEntry[]>([]);
  const cases = useMemo(
    () => [...(manifest.cases.length ? manifest.cases : FALLBACK_MANIFEST.cases), ...customCases],
    [manifest.cases, customCases]
  );
  const defaultId = useMemo(
    () =>
      cases.find((c) => c.id === manifest.defaultCaseId && c.ready)?.id ??
      cases.find((c) => c.ready)?.id ??
      manifest.defaultCaseId,
    [cases, manifest.defaultCaseId]
  );

  const [selectedId, setSelectedId] = useState(defaultId);
  const selected = useMemo(
    () => cases.find((c) => c.id === selectedId) ?? cases[0],
    [cases, selectedId]
  );

  const onUploadReady = useCallback((caseId: string) => {
    setCustomCases((prev) => {
      if (prev.some((c) => c.id === caseId)) return prev;
      return [
        ...prev,
        {
          id: caseId,
          file: `${caseId}.edf`,
          subject: "upload",
          tmin: 0,
          tmax: 0,
          hero: false,
          title: "Your upload",
          summary: "Personal scalp EEG processed with dSPM and sLORETA.",
          durationSec: 0,
          ready: true,
          database: "Your file",
        },
      ];
    });
    setSelectedId(caseId);
  }, []);

  useEffect(() => {
    if (!cases.find((c) => c.id === selectedId)) {
      setSelectedId(defaultId);
    }
  }, [cases, defaultId, selectedId]);

  return (
    <div className="space-y-10" id="explore">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((entry) => (
          <CaseCard
            key={entry.id}
            entry={entry}
            active={entry.id === selectedId}
            onSelect={() => setSelectedId(entry.id)}
          />
        ))}
      </div>

      <UploadSection onReady={onUploadReady} />

      {selected?.ready ? (
        <BrainViewer liveQa={liveQa} caseId={selected.id} />
      ) : (
        <Card className="border-dashed border-border/80 bg-card/50">
          <CardHeader>
            <CardTitle>Processing needed</CardTitle>
            <CardDescription>
              This CHB-MIT example is listed but not published yet. Run{" "}
              <code className="text-xs">python -m pipeline.localize_cases --only {selected?.id}</code>{" "}
              from the repo root, then refresh.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {selected?.hero && heroHasMovie ? (
        <Card className="overflow-hidden border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Seizure spread movie (dSPM)</CardTitle>
            <CardDescription>Same recording as the 3D view — computed, not AI-generated.</CardDescription>
          </CardHeader>
          <CardContent>
            <video
              className="w-full rounded-lg bg-black"
              src="/seizure-dspm.mp4"
              autoPlay
              muted
              loop
              playsInline
              controls
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CaseCard({
  entry,
  active,
  onSelect,
}: {
  entry: CaseManifestEntry;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex h-full flex-col rounded-2xl border p-5 text-left transition ${
        active
          ? "border-teal-400/50 bg-gradient-to-br from-teal-500/10 to-cyan-500/5 shadow-[0_0_40px_-12px_rgba(45,212,191,0.35)]"
          : "border-border/70 bg-card/60 hover:border-teal-500/30 hover:bg-card/90"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {entry.hero ? <Badge className="bg-teal-500/20 text-teal-100">Featured</Badge> : null}
        <Badge variant="outline">{entry.durationSec}s window</Badge>
        {!entry.ready ? <Badge variant="outline">Coming soon</Badge> : null}
      </div>
      <h3 className="text-base font-medium text-foreground">{entry.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
      {entry.peaks ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Peaks · dSPM {prettyPeak(entry.peaks.dspm)} · sLORETA {prettyPeak(entry.peaks.sloreta)}
        </p>
      ) : null}
      <span className="mt-4 text-sm font-medium text-teal-300/90 group-hover:text-teal-200">
        {active ? "Exploring now" : "Explore this case →"}
      </span>
    </button>
  );
}
