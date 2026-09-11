"use client";

import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SceneAction, parseAskAnswer } from "@/lib/guide";

export function AskBox({
  liveQa,
  onAction,
}: {
  liveQa: boolean;
  onAction?: (action: SceneAction) => void;
}) {
  const [question, setQuestion] = useState("");
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
        body: JSON.stringify({ question }),
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
      if (!action.text && payload.answer) {
        action.text = payload.answer;
      }
      setAnswer(action.text);
      onAction?.(action);
    } catch {
      setError("The question could not be answered.");
    } finally {
      setPending(false);
    }
  }

  if (!liveQa) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Live Q&A is off because OPENAI_API_KEY is not set on the server. The
        computed captions on the cortex still come from the disagreement JSON.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="ask-question" className="text-sm text-muted-foreground">
        Ask about this recording, not about a patient.
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="ask-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="When does dSPM peak in this recording?"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !question.trim()}>
          {pending ? "Asking" : "Ask"}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {answer ? (
        <div className="space-y-2">
          <Badge variant="outline">From stats and disagreement JSON</Badge>
          <p className="text-sm leading-relaxed text-foreground">{answer}</p>
        </div>
      ) : null}
    </form>
  );
}
