"use client";

import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// SEO + GEO scene: one centered, frosted `blume.config.ts` card whose seo / ai /
// mcp keys stagger in — the code speaks for itself. Copy sourced from
// the Discoverability section (discoverability/*) and configuration/ask-ai.

const SANS =
  "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace";

const WHITE = "#ffffff";
const WHITE_MUTED = "rgba(255,255,255,0.78)";
const CHROME_BORDER = "rgba(90,100,120,0.14)";

// github-light tokens — matches the money-shot source pane.
const TOK = {
  ink: "#24292e",
  key: "#6f42c1",
  keyword: "#d73a49",
  number: "#005cc5",
  punct: "#8a929b",
};

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const CONFIG = `seo: {
  og: { enabled: true },
  rss: { enabled: true },
  sitemap: true,
  robots: true,
  structuredData: true,
},
ai: {
  llmsTxt: true,
  ask: { enabled: true },
  mcp: { enabled: true },
},`;

interface Seg {
  text: string;
  color: string;
}

// Minimal tokenizer: property keys, `true`/`false`, numbers, punctuation.
const tokenize = (line: string): Seg[] => {
  const segs: Seg[] = [];
  const re =
    /(?<keyword>\btrue\b|\bfalse\b)|(?<num>\b\d[\w.]*)|(?<ident>[A-Za-z_$][\w$]*)|(?<space>\s+)|(?<punct>[^\s\w$])/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const [tok, keyword, num, ident, space, punct] = m;
    if (keyword) {
      segs.push({ color: TOK.keyword, text: tok });
    } else if (num) {
      segs.push({ color: TOK.number, text: tok });
    } else if (ident) {
      const isKey = /^\s*:/u.test(line.slice(re.lastIndex));
      segs.push({ color: isKey ? TOK.key : TOK.ink, text: tok });
    } else if (punct) {
      segs.push({ color: TOK.punct, text: tok });
    } else {
      segs.push({ color: TOK.ink, text: space ?? tok });
    }
  }
  return segs;
};

const CONFIG_LINES = CONFIG.split("\n").map(tokenize);

const CARD_W = 1080;

const TrafficLight = ({ color }: { color: string }) => (
  <span
    style={{
      background: color,
      borderRadius: 999,
      display: "inline-block",
      height: 11,
      width: 11,
    }}
  />
);

export const SeoAeoScene = () => {
  const frame = useCurrentFrame();

  const cardOpacity = interpolate(frame, [0, 16], [0, 1], clamp);
  const cardScale = interpolate(frame, [0, 22], [0.97, 1], {
    ...clamp,
    easing: EASE,
  });
  const cardY = interpolate(frame, [0, 22], [22, 0], {
    ...clamp,
    easing: EASE,
  });

  const headOpacity = interpolate(frame, [66, 86], [0, 1], clamp);
  const headY = interpolate(frame, [66, 86], [16, 0], {
    ...clamp,
    easing: EASE,
  });
  const subOpacity = interpolate(frame, [80, 100], [0, 1], clamp);

  const cardStyle = {
    // oxlint-disable-next-line react-doctor/no-large-animated-blur -- intentional video visual — frosted-glass blur radius tuned for launch render
    WebkitBackdropFilter: "blur(16px)",
    // oxlint-disable-next-line react-doctor/no-large-animated-blur -- intentional video visual — frosted-glass blur radius tuned for launch render
    backdropFilter: "blur(16px)",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(255,255,255,0.85)",
    borderRadius: 14,
    boxShadow:
      "0 30px 70px rgba(30,40,60,0.24), inset 0 1px 0 rgba(255,255,255,0.8)",
    marginTop: 80,
    opacity: cardOpacity,
    overflow: "hidden",
    transform: `translateY(${cardY}px) scale(${cardScale})`,
    width: CARD_W,
  } as const;

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "flex-start" }}
    >
      {/* config card — centered, wider, and mostly opaque so the code reads clearly */}
      <div style={cardStyle}>
        <div
          style={{
            alignItems: "center",
            borderBottom: `1px solid ${CHROME_BORDER}`,
            display: "flex",
            gap: 8,
            height: 40,
            padding: "0 16px",
            position: "relative",
          }}
        >
          <TrafficLight color="#ff5f57" />
          <TrafficLight color="#febc2e" />
          <TrafficLight color="#28c840" />
          {/* absolutely centered so the filename sits mid-card, not after the lights */}
          <div
            style={{
              color: "#6b7280",
              fontFamily: MONO,
              fontSize: 13,
              left: 0,
              position: "absolute",
              right: 0,
              textAlign: "center",
            }}
          >
            blume.config.ts
          </div>
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 18,
            lineHeight: "28px",
            padding: "22px 34px",
            whiteSpace: "pre",
          }}
        >
          {CONFIG_LINES.map((segs, i) => {
            const start = 12 + i * 3;
            const opacity = interpolate(
              frame,
              [start, start + 8],
              [0, 1],
              clamp
            );
            const ty = interpolate(frame, [start, start + 8], [4, 0], {
              ...clamp,
              easing: EASE,
            });
            return (
              <div
                // oxlint-disable-next-line react-doctor/no-array-index-as-key -- static config listing with duplicate lines (`},`); index is the only stable key
                key={i}
                style={{ opacity, transform: `translateY(${ty}px)` }}
              >
                {segs.map((s, j) => (
                  <span key={j} style={{ color: s.color }}>
                    {s.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* headline */}
      <div
        style={{
          marginTop: 46,
          opacity: headOpacity,
          transform: `translateY(${headY}px)`,
        }}
      >
        <span
          style={{
            color: WHITE,
            fontFamily: SANS,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            whiteSpace: "nowrap",
          }}
        >
          SEO and GEO — optimized by default.
        </span>
      </div>

      {/* supporting line — matches the changelog scene */}
      <div
        style={{
          color: WHITE_MUTED,
          fontFamily: SANS,
          fontSize: 19,
          marginTop: 12,
          opacity: subOpacity,
          whiteSpace: "nowrap",
        }}
      >
        Sitemaps, Open Graph, structured data, llms.txt, and Ask AI — generated
        for you.
      </div>
    </AbsoluteFill>
  );
};
