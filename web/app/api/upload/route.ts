import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MAX_BYTES = 120 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const tminRaw = String(form.get("tmin") ?? "0");
  const tmaxRaw = String(form.get("tmax") ?? "40");
  const tmin = Number(tminRaw);
  const tmax = Number(tmaxRaw);

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing EEG file." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".edf")) {
    return Response.json({ error: "Only .edf scalp EEG files are supported." }, { status: 400 });
  }
  if (!Number.isFinite(tmin) || !Number.isFinite(tmax) || tmax <= tmin) {
    return Response.json({ error: "Set a valid seizure window (end must be after start)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File is too large (120 MB max)." }, { status: 400 });
  }

  const uploadId = `upload-${randomUUID().slice(0, 8)}`;
  const repoRoot = path.join(process.cwd(), "..");
  const uploadDir = path.join(repoRoot, "pipeline", "data", "uploads");
  const statusDir = path.join(repoRoot, "web", "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await mkdir(statusDir, { recursive: true });

  const dest = path.join(uploadDir, `${uploadId}.edf`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);
  await writeFile(
    path.join(statusDir, `${uploadId}.json`),
    JSON.stringify({ status: "processing", caseId: uploadId }) + "\n"
  );

  const child = spawn(
    "python3",
    [
      "-m",
      "pipeline.run_upload",
      dest,
      uploadId,
      "--tmin",
      String(tmin),
      "--tmax",
      String(tmax),
    ],
    {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
    }
  );
  child.unref();

  return Response.json({ uploadId, processing: true });
}
