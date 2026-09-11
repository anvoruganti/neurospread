import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { LIMITATIONS, buildAskMessages, isDiagnosticRequest } from "@/lib/ask";
import { parseAskAnswer } from "@/lib/guide";

// Live ask uses a cheap model. Astra is a study subject, not this route.
const ASK_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

async function readPublicJson(name: string): Promise<unknown> {
  const file = path.join(process.cwd(), "public", name);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function POST(request: Request) {
  let body: {
    question?: unknown;
    region?: unknown;
    method?: unknown;
    time?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON { question }." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  if (isDiagnosticRequest(question)) {
    return NextResponse.json(
      { error: "This demo cannot answer clinical questions." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Live Q&A is off." }, { status: 503 });
  }

  let stats: unknown;
  let walkthrough: unknown;
  let disagreement: unknown = {};
  let parcels: { parcels?: Record<string, unknown> } | null = null;
  try {
    [stats, walkthrough] = await Promise.all([
      readPublicJson("seizure-stats.json"),
      readPublicJson("astra-walkthrough.json"),
    ]);
  } catch {
    return NextResponse.json(
      { error: "Computed stats are missing. Run the pipeline first." },
      { status: 503 }
    );
  }

  try {
    disagreement = await readPublicJson("brain/disagreement.json");
  } catch {
    disagreement = {};
  }

  try {
    parcels = (await readPublicJson("brain/parcels.json")) as {
      parcels?: Record<string, unknown>;
    };
  } catch {
    parcels = null;
  }

  const regionName = typeof body.region === "string" ? body.region : undefined;
  const method = typeof body.method === "string" ? body.method : undefined;
  const time = typeof body.time === "number" ? body.time : undefined;
  const parcel =
    regionName && parcels?.parcels ? parcels.parcels[regionName] ?? null : null;

  const messages = buildAskMessages(
    question,
    stats,
    walkthrough,
    LIMITATIONS,
    {
      region: regionName,
      method,
      time,
      parcel,
    },
    disagreement
  );
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ASK_MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    let detail = `OpenAI HTTP ${response.status} for model ${ASK_MODEL}`;
    try {
      const errBody = (await response.json()) as {
        error?: { message?: string; code?: string };
      };
      if (errBody.error?.message) {
        detail = errBody.error.message;
      }
    } catch {
      // keep fallback detail
    }
    return NextResponse.json(
      { error: "Live Q&A is unavailable.", detail },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const answer = payload.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ error: "Live Q&A returned an empty answer." }, { status: 502 });
  }

  const action = parseAskAnswer(answer);
  return NextResponse.json({
    answer: action.text,
    seek_time: action.seek_time ?? null,
    method: action.method ?? null,
    highlight: action.highlight ?? null,
    split: action.split ?? null,
  });
}
