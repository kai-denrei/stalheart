# A6 asset library — game-side feedback

Feedback from integrating SentryTowers_A6 models into Stålheart, for the library
update in progress. Everything here was **measured** against the pinned files,
not read off a README. Revisions: MÖRK at `771e166`, HUGIN and Stålheart at
`c827eda`; the shipped game-ready landmarks at `b22a8c9` (unchanged since).

Two parts: **how packages need to be built** so the game can consume them
without surprises, and **the inconsistencies found**, each with its numbers.

---

## Part 1 — How 3D packages need to be built

### 1. Three tiers, and damage is a separate axis

| tier | job | loads when |
| --- | --- | --- |
| **Full** (LOD0) | close shots, cinematics, recording | chosen by hand; not shipped in the game |
| **Game-ready** (LOD1) | anything articulated, damaged or fighting | near, and always before combat |
| **Static distance** (LOD2) | map, bays, orbital views, loading | far, intact, still |

- D0–D3 are **damage states**, never LODs. Tier × damage is a matrix; the game
  never infers a tier from a D-number.
- A distance tier exists for **D0 only** unless a damaged state is visible from
  far away.
- The game pins **plain GLB** and packs its own release, so the plain file is
  the one that matters. Optional `.meshopt.glb` copies are welcome but unused.

### 2. Names are an API — keep them stable and loader-safe

The game looks nodes up by name after three.js loads them, and three.js
**sanitises** names: whitespace becomes `_`, and `[ ] . : /` are removed.

- **Use names with no spaces and no dots.** MÖRK's barrel is authored as
  `"Long cannon barrel"` and only resolves as `Long_cannon_barrel` after
  sanitising. It works, but a raw-name check reported it missing and nearly
  blocked a safe adoption.
- **Never rename or remove a node the game pins** without a versioned mapping.
  Between `8de41ec` and `771e166`, MÖRK lost `Turret cheek armor` — harmless,
  because nothing referenced it, but the next one might be.
- Every articulated tier must carry **every socket and pivot** the game tier
  carries. For MÖRK the game enforces 17: `HOVER_RIG`, `HULL_SUSPENSION`,
  `TURRET_YAW`, `GUN_PITCH`, `GUN_RECOIL`, `MUZZLE_00`, `PLASMA_MUZZLE_L/R`,
  `AMMO_PORT_LIGHT_00`–`08`, plus `PLASMA_YAW_L/R` and the barrel.

### 3. A named node must still own what it names

This is the most important rule and the one currently broken.

- **A part the game may hide must own its geometry, in every tier.** A node that
  survives while its triangles are merged elsewhere passes every name check and
  silently stops hiding anything. (`docs/ASSET-COLLABORATION.md` already names
  `REUSABLE_BOOSTER` as such a part.)
- **An animated node must carry geometry.** A clip that keeps its node names but
  moves empty nodes plays without anything visibly moving. All current LOD1 clips
  pass this — keep it that way.
- In a distance tier, lookup nodes with no geometry are fine **for sockets and
  pivots**, never for hideable parts.

### 4. One frame for every file in a family

- Same **origin, units, up and forward** across tiers and damage states.
- **Same dimensions** across tiers, within about 1%. The game fits every tier
  with the same box, so a tier of a different size **pops** when it swaps.
- Damaged states share the intact state's origin and scale.
- If a tier is **deliberately** a different shape or pose (a parked, settled
  hull, say), say so in the manifest, with the measured delta.

### 5. Say how you counted

The game compares numbers from different tools, and two correct counts can
disagree:

- MÖRK's shipped hull is **18,812** triangles counted as unique geometry in the
  GLB, and **24,196** counted as rendered meshes after the game loads and merges
  it. Both are right.
- The game's asset guard counts **every node that uses a mesh** — a mesh shared
  by two nodes counts twice — which matches your current READMEs exactly.
  Please keep publishing figures that way, and state it in the manifest.
- Draws are counted the same way: mesh uses × primitives.

### 6. Budgets live in the manifest, machine-readable

The game reads `budgets` straight from the pinned `manifest-lods.json` and fails
its check when a tier exceeds them. Keep that block present, stable and in the
same shape for every family:

```json
"budgets": {
  "lod1": { "triangles_max": 8000, "draw_calls_max": 10, "plain_bytes_max": 400000 },
  "lod2": { "triangles_max": 3000, "draw_calls_max": 1,  "plain_bytes_max": 250000 }
}
```

Also useful per file, in one schema for every family: tier, damage state,
SHA-256, plain bytes, triangles, draws, dimensions, clips, sockets, hideable
parts, and review state. The hashes you already publish matched ours on every
file checked.

### 7. Avoid degenerate triangles in low-poly exports

The game's release packing drops degenerate triangles, and low-poly tiers lose
proportionally more:

| file | source | packed | removed |
| --- | --- | --- | --- |
| MÖRK original d0 | 24,196 | 24,082 | 0.47% |
| MÖRK LOW d0 | 6,742 | 6,638 | **1.54%** |
| MÖRK LOD2 d0 | 1,706 | 1,706 | 0% |

Harmless today, but it means your published counts are not what ships, and a
simplifier pass that leaves slivers costs budget for nothing.

### 8. Selection thresholds — one meaning for "hysteresis"

- Landmarks swap by **camera distance**. Characters (Isao) should swap by
  **projected screen size** — your Isao manifest says so, and the game does not
  do this yet.
- The provisional contract is **150 m with 20 m hysteresis** (additive). The game
  currently swaps at 150 m and back past **195 m** (a ×1.3 multiplier). One side
  should move, decided on the game camera and reference phone. Please state
  hysteresis in metres.

### 9. Emotions — one vocabulary

Isao's face in the game is 21 expressions, each an 8×8 dot matrix ported
verbatim from the Braille lab. Isao-Birudorōn authors 14 as **8×6** LED glyphs
with body gestures. Twelve names match. Before integration:

- The model lacks **`focused`** — Isao's most-used face in the game's dialogue
  (six uses) — plus `awe`, `frustrated` and `scan` (two uses).
- The model adds `working` and `alarm`, which the game has no line for yet.
- The game falls back to `neutral` silently for an unknown emotion, so a
  mismatch shows up as a blank face, not an error.

Either the model gains the missing performances, or both sides agree a mapping
(for example `focused` → `working`).

---

## Part 2 — Inconsistencies found

### A. HUGIN LOD1 and LOD2 — booster can no longer be hidden · **blocking**

The story places the launchpad with `hide: ['REUSABLE_BOOSTER']`.

| file | triangles under `REUSABLE_BOOSTER` | share of triangles inside the booster's box |
| --- | --- | --- |
| shipped game d0 | **6,572** (26 meshes, 16.5% of the model) | 17.9% with booster · **1.6%** without |
| LOD1 d0 | **0** | **21.9%** |
| LOD2 d0 | **0** | **24.5%** |

The node survives but owns nothing, and the booster's geometry is still there,
merged into consolidated static meshes. Hiding the node would do nothing. A
height test couldn't show this (the booster tops out at 18.4 m under a 33.1 m
tower); the density test does.

**Ask:** keep the booster as its own geometry under `REUSABLE_BOOSTER` in LOD1
and LOD2. HUGIN is otherwise sound — all six catcher joints move geometry and
dimensions agree within 0.1% — and is held back on this alone.

### B. MÖRK LOD2 proxy — authored 6.6% shorter than the hull

In its own metres, with footprint matching the hull to 0.1%:

| | width × height × length |
| --- | --- |
| hull (shipped d0 and LOW d0 agree) | 5.825 × **3.016** × 13.280 m |
| LOD2 proxy | 5.819 × **2.819** × 13.267 m |

Base about **2 cm higher**, top about **18 cm lower**. Built in the game's
viewer: hull `1.1405 × 0.5905 × 2.6000`, proxy `1.1404 × 0.5524 × 2.6000`.

**Ask:** is this a deliberate parked pose? If yes, note it in the manifest. If
not, match the hull's height. The game pins the measured delta in a test, so
either answer is a one-line change on our side.

### C. MÖRK tier naming — the "game" file is the original-detail tier

The file the game has shipped as its hull, `mork_hover_tank_d0.glb`, is the tier
the hover-tank page labels **Original detail**. The intended game tier is
`mork_hover_tank_low_d0.glb`, which didn't exist at our older pin. Your roadmap
item 4 (truthful readiness labels) covers this; worth making file names say
their tier, e.g. `_lod0` / `_lod1` / `_lod2`, as HUGIN and Stålheart now do.

### D. MÖRK LOD2 callout file is empty

`mork_hover_tank_d0_lod2-callouts.json` is 3 bytes (no entries), while LOD2
keeps all 17 socket nodes. Fine for a static proxy, but it reads as a missing
export. Either ship the socket list or omit the file.

### E. Stålheart LOD1 — hose omission is correct; say it in the file list

Verified: `Terraforming_Cycle` keeps exactly nine controls — `GANTRY_TRAVEL_Y`,
`CARRIAGE_TRAVEL_X`, `TOOL_LIFT_Z`, `J1_BASE_YAW` … `J6_TOOL_ROLL` — each carrying
geometry, and drops exactly forty `Flexible_carriage_material_feed` segments.
Anything that names a hose segment will find nothing in LOD1; the manifest note
covers it, so keep that note beside the clip data.

### F. Swap threshold and characters

See Part 1 §8: 150 m ± 20 m (contract) against 150 m / 195 m (game); and
screen-size selection for characters, which the landmark mechanism doesn't cover.

### G. Isao-Birudorōn emotion coverage

See Part 1 §9: `focused`, `awe`, `frustrated`, `scan` missing; grid 8×6 against
8×8.

---

## What was verified clean

- Every HUGIN and Stålheart D0 LOD hash matches your `manifest-lods.json`.
- Every published triangle, draw and byte figure checked matches the file.
- MÖRK LOW: all 17 sockets, both plasma pivots, six clips, the barrel, the same
  109 nodes, and a byte-identical 142-entry callout file; same size as the hull to
  0.01% when built.
- Stålheart LOD1/LOD2 and HUGIN LOD1: dimensions within 0.1% of the shipped tier;
  every animated node carries geometry.
- The game-ready landmark files are unchanged between `b22a8c9` and `c827eda`.

Game-side status lives in `ROADMAP.md`; decisions and evidence in
`docs/log/entries/2026-09-14-*`.
