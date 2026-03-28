import { type NextRequest, NextResponse } from "next/server";
import {
  BACKEND_BASE_URL,
  type WorkflowAction,
  workflowActionPaths,
} from "@/lib/founder-workflow";

function isWorkflowAction(value: string): value is WorkflowAction {
  return value in workflowActionPaths;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;

  if (!isWorkflowAction(action)) {
    return NextResponse.json({ error: "Unknown founder workflow action." }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const upstreamUrl = new URL(workflowActionPaths[action], BACKEND_BASE_URL);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const contentType =
      upstreamResponse.headers.get("content-type") ?? "application/json";
    const payload = await upstreamResponse.text();

    return new NextResponse(payload, {
      status: upstreamResponse.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch (error) {
    console.error(`Founder workflow proxy failed for ${action}:`, error);

    return NextResponse.json(
      {
        error:
          "Unable to reach the localhost workflow service on port 8000.",
        detail:
          error instanceof Error ? error.message : "Unknown proxy failure.",
      },
      { status: 502 }
    );
  }
}
