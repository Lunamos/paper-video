// Vertical scenes, in film order (ids = scene ids in scenes.json). Scenes listed in layout.V_DROP are left out of the
// vertical cut; a scene without an entry here shows only the captions over the backdrop.
import React from "react";
import { VExample } from "./VExample";

export const VSCENES: { id: string; name: string; comp: React.FC }[] = [{ id: "s_example", name: "VExample", comp: VExample }];
