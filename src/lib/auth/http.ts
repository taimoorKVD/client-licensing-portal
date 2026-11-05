import "server-only";

import { NextResponse } from "next/server";
import type { ServiceResult } from "@/lib/auth/types";

export function assertSameOrigin(request: Request): NextResponse | null {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin") return null;
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!origin || !host) {
    return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  }
  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  }
  return null;
}

export function resultResponse<T>(result: ServiceResult<T>): NextResponse {
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
