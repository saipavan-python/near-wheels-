/**
 * Minimal Google Gemini REST adapter with native function calling.
 * No SDK dependency; works on Node 18 fetch. The model NEVER touches the DB —
 * it can only act through declared tools that hit real backend services.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ContentPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}
export interface Content {
  role: "user" | "model";
  parts: ContentPart[];
}

interface GenerateResult {
  ok: boolean;
  status?: number;
  error?: string;
  text?: string;
  functionCalls?: { name: string; args: Record<string, unknown> }[];
  raw?: unknown;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

async function callGenerate(
  body: Record<string, unknown>
): Promise<GenerateResult> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  try {
    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.error?.message || `Gemini HTTP ${res.status}`,
      };
    }
    const candidate = data?.candidates?.[0];
    const parts: ContentPart[] = candidate?.content?.parts || [];
    const texts = parts.filter((p) => typeof p.text === "string").map((p) => p.text as string);
    const calls = parts
      .filter((p) => p.functionCall)
      .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args || {} }));
    return { ok: true, text: texts.join("\n") || undefined, functionCalls: calls.length ? calls : undefined, raw: data };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Gemini request failed" };
  }
}

/** Multi-round tool loop. Executor must be side-effect aware (bookings!). */
export async function runWithTools(opts: {
  systemInstruction: string;
  contents: Content[];
  tools: ToolDeclaration[];
  maxRounds?: number;
  execute: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): Promise<
  | { ok: false; error: string }
  | { ok: true; text: string; trace: { tool: string; args: unknown; result: unknown }[] }
> {
  const { systemInstruction, contents, tools, maxRounds = 6, execute } = opts;
  const trace: { tool: string; args: unknown; result: unknown }[] = [];
  let round = 0;

  let working: Content[] = [...contents];

  while (round < maxRounds) {
    round++;
    const res = await callGenerate({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: working,
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
    });

    if (!res.ok) return { ok: false, error: res.error || "unknown" };

    if (res.functionCalls && res.functionCalls.length) {
      // record assistant's function-call turn
      working.push({
        role: "model",
        parts: res.functionCalls.map((fc) => ({ functionCall: fc })),
      });
      // execute every call; feed responses back
      const responseParts: ContentPart[] = [];
      for (const fc of res.functionCalls) {
        let response: unknown;
        try {
          response = await execute(fc.name, fc.args);
        } catch (e: any) {
          response = { error: e?.message || "tool failed", errorCode: e?.constructor?.name };
        }
        trace.push({ tool: fc.name, args: redactArgs(fc.args), result: summarize(response) });
        responseParts.push({ functionResponse: { name: fc.name, response: { result: response } } });
      }
      working.push({ role: "user", parts: responseParts });
      continue;
    }

    return { ok: true, text: res.text || "", trace };
  }

  return { ok: true, text: "Let me pick up from here — could you tell me once more what you'd like?", trace };
}

function redactArgs(args: Record<string, unknown>) {
  const clone = { ...args };
  delete clone.customer_phone;
  return clone;
}

function summarize(r: unknown) {
  const s = JSON.stringify(r);
  return s && s.length > 400 ? s.slice(0, 400) + "…(truncated)" : r;
}
