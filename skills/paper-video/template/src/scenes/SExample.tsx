// s_example — demonstrates the scene conventions on a neutral toy topic (the period of a simple pendulum).
//  1. Beats are driven by ANCHORS (words in scenes.json), never by hard-coded seconds; each anchor has a fallback
//     frame so the scene still plays when the anchor is missing (e.g. before the voice exists).
//  2. Schematic drawings are stroke-drawn (strokeDasharray / strokeDashoffset) and labelled SCHEMATIC.
//  3. Data charts carry a SourceNote. Numbers appear only at their final value (no count-up).
//  4. All on-screen text lives in a per-language TXT object, selected with useLang().
//  5. Content stays above layout.contentBottom (y≈860); the footnote sits at layout.footnoteBottom; captions below.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { LineChart } from "../components/Chart";
import { ChapterTag, Headline, MonoLabel, Pill, prog, SourceNote, Tex, WipeReveal } from "../components/core";
import { HandLoop, HandNote } from "../components/Hand";
import { clamp, color, ease, font } from "../theme";
import { useAnchor, useLang } from "../timeline/SceneContext";

const TXT = {
  en: {
    chapter: "Example",
    title: "What sets a pendulum's period?",
    length: "length L",
    xLabel: "LENGTH L (m)",
    yLabel: "PERIOD T (s)",
    pill: "4× longer",
    pillValue: "2× period",
    note: "twice as long",
    source: "computed from T = 2π√(L/g), g = 9.81 m/s² (small-angle approximation)",
  },
  zh: {
    chapter: "示例",
    title: "单摆的周期由什么决定？",
    length: "摆长 L",
    xLabel: "摆长 L (m)",
    yLabel: "周期 T (s)",
    pill: "摆长 ×4",
    pillValue: "周期 ×2",
    note: "两倍",
    source: "由 T = 2π√(L/g) 计算，g = 9.81 m/s²（小角度近似）",
  },
};

// "real-data-style" series: exact values of the formula (in a real film: numbers from the paper / result files only)
const G = 9.81;
const LENGTHS = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
const PERIOD = LENGTHS.map((L) => [L, 2 * Math.PI * Math.sqrt(L / G)]);

// chart geometry (1920×1080 frame coordinates)
const CH = { x: 1010, y: 420, w: 760, h: 360, xDomain: [0, 4] as [number, number], yDomain: [0, 5] as [number, number] };
const px = (L: number) => CH.x + (L / CH.xDomain[1]) * CH.w;
const py = (T: number) => CH.y + CH.h - (T / CH.yDomain[1]) * CH.h;

export const SExample: React.FC = () => {
  const f = useCurrentFrame();
  const lang = useLang();
  const T = TXT[lang];

  // anchors (frames relative to the scene start) with fallbacks
  const PEND = useAnchor("pendulum", 12);
  const LEN = useAnchor("length", 60);
  const FORMULA = useAnchor("formula", 110);
  const CHART = useAnchor("chart", 200);
  const TWICE = useAnchor("twice", 260);

  const titleP = prog(f, 0, 20, ease.out);
  // pendulum schematic: string draws on, bob pops, then it swings (a pure function of the frame)
  const stringP = prog(f, PEND, 24);
  const bobP = prog(f, PEND + 16, 14, ease.out);
  const swingIn = prog(f, PEND + 28, 30);
  const angle = 18 * swingIn * Math.sin((f - PEND) / 14);
  const lenP = prog(f, LEN, 18, ease.out);
  const eqP = prog(f, FORMULA, 36);
  const axisP = prog(f, CHART - 20, 18);
  const lineP = prog(f, CHART - 6, 36, ease.inOut);
  const srcP = prog(f, CHART - 20, 18);
  const loopP = prog(f, TWICE, 22);
  const noteP = prog(f, TWICE + 12, 14, ease.out);
  const pillP = prog(f, TWICE + 4, 18, ease.out);

  // pivot + schematic geometry
  const px0 = 470;
  const py0 = 300;
  const Lpx = 380;
  const rad = (angle * Math.PI) / 180;
  const bx = px0 + Lpx * Math.sin(rad);
  const by = py0 + Lpx * Math.cos(rad);
  const last = PERIOD[PERIOD.length - 1];

  return (
    <>
      <ChapterTag index="01" title={T.chapter} p={titleP} />
      <Headline p={titleP}>{T.title}</Headline>

      {/* ---- schematic (left) */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={px0 - 90} x2={px0 + 90} y1={py0} y2={py0} stroke={color.gridStrong} strokeWidth={3} opacity={stringP} />
        <line
          x1={px0}
          y1={py0}
          x2={bx}
          y2={by}
          stroke={color.text2}
          strokeWidth={3}
          strokeDasharray={Lpx}
          strokeDashoffset={Lpx * (1 - stringP)}
          strokeLinecap="round"
        />
        <circle cx={bx} cy={by} r={30 * bobP} fill={color.accent} style={{ filter: `drop-shadow(0 0 16px ${color.accentGlow})` }} />
        {/* length bracket */}
        <g opacity={lenP}>
          <line x1={px0 - 150} x2={px0 - 150} y1={py0} y2={py0 + Lpx * lenP} stroke={color.accent2} strokeWidth={2.5} />
          <line x1={px0 - 162} x2={px0 - 138} y1={py0} y2={py0} stroke={color.accent2} strokeWidth={2.5} />
          <line x1={px0 - 162} x2={px0 - 138} y1={py0 + Lpx} y2={py0 + Lpx} stroke={color.accent2} strokeWidth={2.5} opacity={lenP} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: px0 - 330, top: py0 + Lpx / 2 - 20, fontFamily: font.sans, fontSize: 30, color: color.accent2, opacity: lenP }}>
        {T.length}
      </div>
      <MonoLabel style={{ position: "absolute", left: px0 - 150, top: 740, opacity: stringP }}>schematic</MonoLabel>

      {/* ---- equation (top right), written on with a wipe; \B{} = accent2 (the length), \A{} = accent (the period) */}
      <div style={{ position: "absolute", left: CH.x, top: 250 }}>
        <WipeReveal p={eqP}>
          <Tex tex={"\\A{T} = 2\\pi\\sqrt{\\frac{\\B{L}}{g}}"} size={52} />
        </WipeReveal>
      </div>

      {/* ---- chart (right): axes fade in, the curve draws left to right */}
      <LineChart
        {...CH}
        xTicks={[0, 1, 2, 3, 4]}
        yTicks={[0, 1, 2, 3, 4, 5]}
        xLabel={T.xLabel}
        yLabel={T.yLabel}
        series={[{ name: "T(L)", pts: PERIOD, color: color.accent, marker: "circle" }]}
        progress={lineP}
        axisP={axisP}
      />
      {/* final value label appears only once the curve has arrived (no count-up) */}
      <div
        style={{
          position: "absolute",
          left: px(last[0]) - 60,
          top: py(last[1]) - 58,
          fontFamily: font.mono,
          fontSize: 22,
          color: color.text,
          opacity: interpolate(lineP, [0.95, 1], [0, 1], clamp),
        }}
      >
        {last[1].toFixed(2)} s
      </div>
      <HandLoop x={px(last[0]) - 16} y={py(last[1]) - 16} w={32} h={32} p={loopP} seed={5} />
      <HandNote x={px(last[0]) - 330} y={py(last[1]) - 96} p={noteP} zh={lang === "zh"}>
        {T.note}
      </HandNote>
      <div style={{ position: "absolute", left: CH.x + 400, top: 272, opacity: pillP }}>
        <Pill tone="accent2" label={T.pill}>
          {T.pillValue}
        </Pill>
      </div>

      <SourceNote label="data" p={srcP}>
        {T.source}
      </SourceNote>
    </>
  );
};
