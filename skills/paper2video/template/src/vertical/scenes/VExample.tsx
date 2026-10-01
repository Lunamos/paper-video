// s_example, vertical: one headline per beat, the main visual tall and full-width, a big number on its word, a source.
// Copy this pattern for every scene of the vertical cut (one file per scene, keyed to the same voice anchors).
import React from "react";
import { useCurrentFrame } from "remotion";
import { prog } from "../../components/core";
import { color } from "../../theme";
import { useAnchor } from "../../timeline/SceneContext";
import { STAGE } from "../layout";
import { Hot, VBigNumber, VChip, VHead, VSource } from "../VKit";

export const VExample: React.FC = () => {
  const f = useCurrentFrame();
  const PENDULUM = useAnchor("pendulum", 20);
  const FORMULA = useAnchor("formula", 120);
  const TWICE = useAnchor("twice", 240);
  const pHead = prog(f, PENDULUM - 4, 14);
  const pSwing = prog(f, PENDULUM, 24);
  const pFormula = prog(f, FORMULA - 4, 14);
  const pTwice = prog(f, TWICE - 2, 12);
  // a tall pendulum that fills the frame: the pivot in the top band, the bob low in the stage
  const angle = 18 * Math.sin(f / 14) * pSwing;
  return (
    <>
      <div style={{ position: "absolute", left: 540, top: 0, width: 4, height: 1160, background: color.text3, transformOrigin: "50% 0", transform: `rotate(${angle}deg)`, opacity: pSwing }}>
        <div style={{ position: "absolute", left: -58, bottom: -58, width: 120, height: 120, borderRadius: 60, background: color.accent, boxShadow: `0 0 60px ${color.accentGlow}` }} />
      </div>
      <VHead p={pHead * (1 - pFormula)}>
        Twice as <Hot>long</Hot>
      </VHead>
      <VHead p={pFormula}>
        T ∝ <Hot>√L</Hot>
      </VHead>
      <VBigNumber value="×1.41" p={pTwice} y={STAGE.y + 140} />
      <VChip y={STAGE.y - 70} p={pSwing}>
        SCHEMATIC
      </VChip>
      <VSource p={pFormula}>small-angle approximation · source: your paper, eq. (1)</VSource>
    </>
  );
};
