import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/lexlens/server/analyze";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Legacy standalone analysis endpoint. The product UI uses the account-
 *  scoped pipeline (/api/notices → /api/notices/[id]/analyze) instead.
 *  Internal pipeline metadata is intentionally not exposed here. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string };
    const noticeText = (body.text ?? "").trim();

    if (noticeText.length < 40) {
      return NextResponse.json(
        { error: "Notice text is too short. Paste at least a few sentences of the notice." },
        { status: 400 }
      );
    }

    const result = await runAnalysis(noticeText);

    return NextResponse.json({
      base: result.base,
      processing_ms: result.processingMs,
      pipeline_meta: {
        notice_chars: result.internalMeta.noticeChars,
        confidence_capped: result.internalMeta.confidenceCapped,
        safety_edits: result.internalMeta.safetyEdits,
      },
    });
  } catch {
    return NextResponse.json({ error: "Analysis could not be completed. Please try again." }, { status: 500 });
  }
}
