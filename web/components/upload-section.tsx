"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UploadSectionProps = {
  onReady: (caseId: string) => void;
};

type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "failed";

export function UploadSection({ onReady }: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uploadId || status !== "processing") return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/upload/${uploadId}`);
        if (!res.ok) return;
        const payload = (await res.json()) as {
          status?: string;
          caseId?: string;
          error?: string;
          message?: string;
          window?: { tmin: number; tmax: number };
        };
        if (payload.message && status === "processing") {
          setMessage(payload.message);
        }
        if (payload.status === "ready" && payload.caseId) {
          setStatus("ready");
          const win = payload.window;
          setMessage(
            win
              ? `Your map is ready. We focused on the most active ${Math.round(win.tmax - win.tmin)} seconds of the recording.`
              : "Your map is ready in the viewer below."
          );
          onReady(payload.caseId);
          window.clearInterval(id);
        } else if (payload.status === "failed") {
          setStatus("failed");
          setMessage(
            payload.error ??
              "We could not process this file. Try a longer recording (3+ minutes) or a hospital-exported scalp EEG."
          );
          window.clearInterval(id);
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [uploadId, status, onReady]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose your hospital EEG file (.edf) first.");
      return;
    }
    setStatus("uploading");
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const payload = (await response.json()) as {
        uploadId?: string;
        error?: string;
        processing?: boolean;
      };
      if (!response.ok || !payload.uploadId) {
        setStatus("failed");
        setMessage(payload.error ?? "Upload failed.");
        return;
      }
      setUploadId(payload.uploadId);
      setStatus("processing");
      setMessage(
        "Upload received. We are finding where the seizure activity is strongest and building your 3D map — this can take several minutes."
      );
    } catch {
      setStatus("failed");
      setMessage("Network error while uploading.");
    }
  }

  return (
    <Card
      className="relative overflow-hidden border-cyan-500/20 bg-[#060a14]/90 shadow-[inset_0_1px_0_rgba(56,189,248,0.12)]"
      id="upload"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Bring your own EEG file</CardTitle>
          <Badge variant="outline">.edf</Badge>
        </div>
        <CardDescription>
          No timestamps to enter. Upload the file from the hospital system — we find the most
          active seizure segment, map it on a standard brain, and show how activity spreads. For
          learning only; not medical advice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-stretch" onSubmit={onSubmit}>
          <div
            className="flex flex-1 cursor-pointer flex-col justify-center rounded-xl border border-dashed border-cyan-500/30 bg-black/30 px-4 py-8 text-sm text-muted-foreground transition hover:border-cyan-400/50"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            {file ? file.name : "Tap to choose your EEG file"}
            <input
              ref={inputRef}
              type="file"
              accept=".edf,application/octet-stream"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            type="submit"
            className="min-h-[52px] shrink-0 bg-gradient-to-r from-cyan-400 to-sky-500 px-8 text-slate-950 hover:from-cyan-300 hover:to-sky-400"
            disabled={status === "uploading" || status === "processing"}
          >
            {status === "processing" ? "Building map…" : "Show my seizure map"}
          </Button>
        </form>
        {message ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
