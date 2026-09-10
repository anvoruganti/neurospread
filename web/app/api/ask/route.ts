import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { LIMITATIONS, buildAskMessages, isDiagnosticRequest } from "@/lib/ask";

const ASTRA_MODEL = "gpt-6-astra";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

async function readPublicJson(name: string): Promise<unknown> {
  const file = path.join(process.cwd(), "public", name);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function POST(request: Request) {
  let body: { question?: unknown };
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

  const messages = buildAskMessages(question, stats, walkthrough, LIMITATIONS);
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: ASTRA_MODEL, messages }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Astra is unavailable." }, { status: 502 });
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const answer = payload.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ error: "Astra returned an empty answer." }, { status: 502 });
  }

  return NextResponse.json({ answer });
}
