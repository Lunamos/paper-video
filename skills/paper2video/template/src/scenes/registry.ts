// Scene registry: id (must match the scene ids in scenes.json / public/data/vo.<cut>.json) -> component.
// `name` is used for the per-scene preview compositions (EN-<name>, ZH-<name>); letters, digits and "-" only.
// Order here does not matter: the film's order comes from the vo JSON.
import React from "react";
import { SExample } from "./SExample";

export const SCENES: { id: string; comp: React.FC; name: string }[] = [
  { id: "s_example", comp: SExample, name: "SExample" },
];
