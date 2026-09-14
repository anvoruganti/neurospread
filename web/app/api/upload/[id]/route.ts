import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!/^upload-[a-z0-9]+$/.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const statusPath = path.join(process.cwd(), "..", "web", "public", "uploads", `${id}.json`);
  try {
    const raw = await readFile(statusPath, "utf8");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json({ status: "processing", caseId: id });
  }
}
