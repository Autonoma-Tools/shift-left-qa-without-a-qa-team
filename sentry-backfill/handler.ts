import crypto from "node:crypto";
import express, { type Request, type Response } from "express";

/**
 * Sentry -> Slack -> Autonoma backfill webhook handler.
 *
 * When Sentry reports a new issue at or above a severity threshold, this
 * handler posts a structured alert to Slack and asks Autonoma to backfill the
 * missing E2E test for the affected route.
 *
 * Fails closed: if required env vars are missing the process refuses to start.
 */

const REQUIRED_ENV = [
  "SENTRY_WEBHOOK_SECRET",
  "SLACK_WEBHOOK_URL",
  "AUTONOMA_API_KEY",
] as const;

type RequiredEnv = (typeof REQUIRED_ENV)[number];

function loadEnv(): Record<RequiredEnv, string> {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start: missing required env vars: ${missing.join(", ")}`,
    );
  }
  return {
    SENTRY_WEBHOOK_SECRET: process.env.SENTRY_WEBHOOK_SECRET as string,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL as string,
    AUTONOMA_API_KEY: process.env.AUTONOMA_API_KEY as string,
  };
}

const AUTONOMA_BACKFILL_URL =
  process.env.AUTONOMA_BACKFILL_URL ??
  "https://api.autonoma.app/v1/tests/backfill";

// Sentry issue levels ordered from least to most severe.
const SEVERITY_ORDER = ["debug", "info", "warning", "error", "fatal"] as const;
type Severity = (typeof SEVERITY_ORDER)[number];

const SEVERITY_THRESHOLD: Severity =
  (process.env.SEVERITY_THRESHOLD as Severity) ?? "error";

function meetsThreshold(level: string | undefined): boolean {
  const idx = SEVERITY_ORDER.indexOf((level ?? "info") as Severity);
  const thresholdIdx = SEVERITY_ORDER.indexOf(SEVERITY_THRESHOLD);
  if (idx === -1) return false;
  return idx >= thresholdIdx;
}

/**
 * Verify the Sentry webhook signature.
 * Sentry signs the raw request body with HMAC-SHA256 using the client secret
 * and sends it in the `sentry-hook-signature` header.
 */
function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface SentryIssuePayload {
  data?: {
    issue?: {
      id?: string;
      title?: string;
      level?: string;
      culprit?: string;
      web_url?: string;
      metadata?: { value?: string };
    };
  };
}

function extractRoute(culprit: string | undefined, title: string | undefined): string {
  // Sentry "culprit" often carries the transaction/route, e.g. "GET /checkout".
  const source = culprit ?? title ?? "";
  const match = source.match(/\/[\w\-/]*/);
  return match ? match[0] : "/";
}

async function postToSlack(webhookUrl: string, issue: NonNullable<NonNullable<SentryIssuePayload["data"]>["issue"]>): Promise<void> {
  const body = {
    text: `:rotating_light: New ${issue.level ?? "error"} in production`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*${issue.title ?? "Untitled issue"}*`,
            `Level: \`${issue.level ?? "unknown"}\``,
            `Route: \`${extractRoute(issue.culprit, issue.title)}\``,
            issue.web_url ? `<${issue.web_url}|View in Sentry>` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${res.statusText}`);
  }
}

async function requestBackfill(apiKey: string, route: string, issueId: string | undefined): Promise<void> {
  const res = await fetch(AUTONOMA_BACKFILL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      route,
      reason: "sentry-issue",
      sentry_issue_id: issueId ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Autonoma backfill failed: ${res.status} ${res.statusText}`);
  }
}

export function createApp() {
  const env = loadEnv();
  const app = express();

  // Capture the raw body so we can verify the HMAC signature.
  app.use(
    "/webhooks/sentry",
    express.raw({ type: "application/json" }),
  );

  app.post("/webhooks/sentry", async (req: Request, res: Response) => {
    const rawBody = req.body as Buffer;
    const signature = req.header("sentry-hook-signature");

    if (!verifySignature(rawBody, signature, env.SENTRY_WEBHOOK_SECRET)) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }

    let payload: SentryIssuePayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as SentryIssuePayload;
    } catch {
      res.status(400).json({ error: "invalid JSON body" });
      return;
    }

    const issue = payload.data?.issue;
    if (!issue) {
      res.status(400).json({ error: "no issue in payload" });
      return;
    }

    if (!meetsThreshold(issue.level)) {
      res.status(202).json({ status: "ignored", reason: "below threshold" });
      return;
    }

    const route = extractRoute(issue.culprit, issue.title);

    try {
      await postToSlack(env.SLACK_WEBHOOK_URL, issue);
      await requestBackfill(env.AUTONOMA_API_KEY, route, issue.id);
    } catch (err) {
      console.error("backfill pipeline failed:", err);
      res.status(502).json({ error: "downstream call failed" });
      return;
    }

    res.status(200).json({ status: "queued", route });
  });

  return app;
}

// Start the server when run directly (ts-node handler.ts / node handler.js).
const isMain =
  typeof require !== "undefined" && require.main === module;
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp();
  app.listen(port, () => {
    console.log(`Sentry backfill handler listening on :${port}`);
  });
}
