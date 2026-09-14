"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UploadSectionProps = {
  onReady: (caseId: string) => void;
};

type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "failed";

export function UploadSection({ onReady }: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tmin, setTmin] = useState("0");
  const [tmax, setTmax] = useState("40");
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
        const payload = (await res.json()) as { status?: string; caseId?: string; error?: string };
        if (payload.status === "ready" && payload.caseId) {
          setStatus("ready");
          setMessage("Your recording is ready in the viewer below.");
          onReady(payload.caseId);
          window.clearInterval(id);
        } else if (payload.status === "failed") {
          setStatus("failed");
          setMessage(payload.error ?? "Processing failed. Check the seizure window and file format.");
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
      setMessage("Choose a scalp EEG file (.edf) first.");
      return;
    }
    setStatus("uploading");
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    body.append("tmin", tmin);
    body.append("tmax", tmax);
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
      setStatus(payload.processing ? "processing" : "ready");
      if (payload.processing) {
        setMessage(
          "We are running dSPM and sLORETA on your file. This can take several minutes — keep this tab open."
        );
      } else if (payload.uploadId) {
        onReady(payload.uploadId);
        setMessage("Upload received.");
      }
    } catch {
      setStatus("failed");
      setMessage("Network error while uploading.");
    }
  }

  return (
    <Card className="border-border/60 bg-gradient-to-br from-slate-900/80 to-slate-950/90" id="upload">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Use your own scalp EEG</CardTitle>
          <Badge variant="outline">.edf</Badge>
        </div>
        <CardDescription>
          Upload a de-identified recording and set the seizure window (seconds). We map it to a
          standard montage, run the same dSPM / sLORETA pipeline, and open it in the 3D viewer. Not
          for diagnosis — research and education only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto]" onSubmit={onSubmit}>
          <div
            className="flex cursor-pointer flex-col justify-center rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-sm text-muted-foreground"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            {file ? file.name : "Drop or click to select an EDF file"}
            <input
              ref={inputRef}
              type="file"
              accept=".edf,application/octet-stream"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Window start (s)
            <Input value={tmin} onChange={(e) => setTmin(e.target.value)} inputMode="decimal" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Window end (s)
            <Input value={tmax} onChange={(e) => setTmax(e.target.value)} inputMode="decimal" />
          </label>
          <Button
            type="submit"
            className="h-full min-h-[44px] bg-teal-500 text-slate-950 hover:bg-teal-400"
            disabled={status === "uploading" || status === "processing"}
          >
            {status === "processing" ? "Processing…" : "Visualize"}
          </Button>
        </form>
        {message ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
