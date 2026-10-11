import { afterAll, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import { join } from "pathe";

import {
  anthropic,
  gemini,
  grok,
  openai,
  resolveAskBackend,
} from "../src/ai/ask.ts";
import type { AssistantAdapter } from "../src/ai/ask.ts";
import { askEndpointTemplate } from "../src/astro/templates.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

/**
 * The generated route for each provider Blume calls directly, loaded outside
 * Astro: the SDK import resolves, the provider factory runs, and the model
 * call goes to the provider's own API with the configured key.
 */

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The generated route's handler, called the way Astro calls an endpoint. */
type AskRoute = (context: { request: Request }) => Promise<Response>;

const dirs: string[] = [];

// The provider answers every call with a 400 (not retried), which the route
// reports through `onError`.
const errorSpy = spyOn(console, "error").mockImplementation(() => {});
const requests: Request[] = [];
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
  // SAFETY: a stand-in for the one fetch signature the provider SDKs call.
  ((input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return Promise.resolve(
      Response.json(
        { error: { message: "Rejected by the test.", type: "invalid" } },
        { status: 400 }
      )
    );
  }) as typeof fetch
);

afterAll(async () => {
  // Both spies wrap process-wide globals; hand them back for the next file.
  errorSpy.mockRestore();
  fetchSpy.mockRestore();
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/**
 * Write the generated route where it can load outside Astro: the one Astro
 * virtual import becomes a stub returning `key`, and the bare specifiers
 * resolve from the Blume package.
 */
const loadRoute = async (
  provider: AssistantAdapter,
  key: string
): Promise<AskRoute> => {
  const parsed = blumeConfigSchema.parse({
    ai: { assistant: { enabled: true, provider } },
  });
  // Ungrounded, so the route needs no retrieval corpus; the grounded path
  // builds the same provider.
  const backend = {
    ...resolveAskBackend(parsed.ai.assistant?.provider),
    grounded: false,
  };
  const resolve = (specifier: string): string =>
    JSON.stringify(pathToFileURL(Bun.resolveSync(specifier, PKG_ROOT)).href);
  const [sdk = ""] = provider.runtimeDeps;
  const source = askEndpointTemplate(backend)
    .replace(
      'import { getSecret } from "astro:env/server";',
      `const getSecret = (_name: string) => ${JSON.stringify(key)};`
    )
    .replace(
      '"blume/core/request-body.ts"',
      JSON.stringify(
        pathToFileURL(join(PKG_ROOT, "src/core/request-body.ts")).href
      )
    )
    .replace('from "ai";', `from ${resolve("ai")};`)
    .replace(`from ${JSON.stringify(sdk)};`, `from ${resolve(sdk)};`);
  const dir = await mkdtemp(join(tmpdir(), "blume-ask-providers-"));
  dirs.push(dir);
  const file = join(dir, "ask.ts");
  await writeFile(file, source, "utf-8");
  // SAFETY: the generated route exports its handler as `POST`.
  const route = (await import(file)) as { POST: AskRoute };
  return route.POST;
};

const ask = (POST: AskRoute): Promise<Response> =>
  POST({
    request: new Request("http://localhost/api/ask", {
      body: JSON.stringify({ messages: [{ content: "hi", role: "user" }] }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  });

describe("the generated assistant route for a direct provider", () => {
  for (const [provider, url, header, value] of [
    [
      openai({ model: "gpt-5.5" }),
      "https://api.openai.com/v1/responses",
      "authorization",
      "Bearer test-key",
    ],
    [
      anthropic({ model: "claude-sonnet-5" }),
      "https://api.anthropic.com/v1/messages",
      "x-api-key",
      "test-key",
    ],
    [
      gemini({ model: "gemini-3.5-flash" }),
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse",
      "x-goog-api-key",
      "test-key",
    ],
    [
      grok({ model: "grok-4.7" }),
      "https://api.x.ai/v1/responses",
      "authorization",
      "Bearer test-key",
    ],
  ] as const) {
    it(`calls the ${provider.kind} API with the configured key`, async () => {
      requests.length = 0;
      errorSpy.mockClear();
      const response = await ask(await loadRoute(provider, "test-key"));
      expect(response.status).toBe(200);
      // The provider's rejection ends the stream and is logged, not thrown.
      expect(await response.text()).toBe("");
      expect(requests.map((request) => request.url)).toEqual([url]);
      expect(requests[0]?.headers.get(header)).toBe(value);
      expect(errorSpy.mock.calls[0]?.[0]).toBe("Assistant provider error:");
    });

    it(`answers 503 naming the unset key for ${provider.kind}`, async () => {
      requests.length = 0;
      const response = await ask(await loadRoute(provider, ""));
      expect(response.status).toBe(503);
      expect(await response.text()).toBe(
        `The assistant is not configured: set ${provider.requiredSecrets[0]}.`
      );
      expect(requests).toEqual([]);
    });
  }
});
