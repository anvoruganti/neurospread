"use client";

import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MethodName,
  ParcelStats,
  numbersStrip,
  suggestedRegionQuestion,
} from "@/lib/brain";
import { SceneAction, parseAskAnswer } from "@/lib/guide";

type RegionChatProps = {
  liveQa: boolean;
  label: string;
  method: MethodName;
  time: number;
  screenX: number;
  screenY: number;
  parcel?: ParcelStats;
  onClose: () => void;
  onAction?: (action: SceneAction) => void;
};

export function RegionChat({
  liveQa,
  label,
  method,
  time,
  screenX,
  screenY,
  parcel,
  onClose,
  onAction,
}: RegionChatProps) {
  const suggestion = suggestedRegionQuestion(label, method, time);
  const [question, setQuestion] = useState(suggestion);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setAnswer(null);
    setError(null);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, region: label, method, time }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        detail?: string;
        seek_time?: number | null;
        method?: SceneAction["method"];
        highlight?: string[] | null;
        split?: boolean | null;
      };
      if (!response.ok) {
        const message = payload.detail
          ? `${payload.error ?? "The question could not be answered."} (${payload.detail})`
          : payload.error ?? "The question could not be answered.";
        setError(message);
        return;
      }
      const action = parseAskAnswer(
        JSON.stringify({
          text: payload.answer ?? "",
          seek_time: payload.seek_time,
          method: payload.method,
          highlight: payload.highlight,
          split: payload.split,
        })
      );
      setAnswer(action.text);
      onAction?.(action);
    } catch {
      setError("The question could not be answered.");
    } finally {
      setPending(false);
    }
  }

  const left = Math.max(8, Math.min(screenX + 12, 360));
  const top = Math.max(8, Math.min(screenY + 12, 80));

  return (
    <div
      className="pointer-events-auto absolute z-20 w-[min(320px,calc(100%-16px))]"
      style={{ left, top }}
    >
      <Card className="border-accent/40 shadow-lg shadow-black/40">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription>
                {method} at {time.toFixed(0)} s
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          <Badge variant="outline">{numbersStrip(parcel, method)}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {!liveQa ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Live Q&A is off because OPENAI_API_KEY is not set. The cortex still
              comes from the source estimate. The strip above is from the parcel
              numbers.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label htmlFor="region-question" className="text-sm text-muted-foreground">
                Ask about this region in this recording.
              </label>
              <Input
                id="region-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={pending}
              />
              <Button type="submit" disabled={pending || !question.trim()}>
                {pending ? "Asking" : "Ask about this parcel"}
              </Button>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {answer ? (
                <div className="space-y-2">
                  <Badge variant="outline">From parcel JSON</Badge>
                  <p className="text-sm leading-relaxed text-foreground">{answer}</p>
                </div>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
