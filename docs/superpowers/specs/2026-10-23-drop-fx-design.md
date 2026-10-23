# THE DROP'S LOOK — the owner's four notes + screenshots (2026-10-23 morning, branch `drop-fx` from `overnight-2026-10-23`)

Owner, 2026-10-23 09:30 JST, after the first test of the FEIDS-26 drop on localhost:8155: "I could not take screenshots because any key press
cancels the animation; FEIDS animation changes; the blue flames and burn animation needs work 2) the mechs too are surrounded by an orange
bubble, it should be a more believable mix of re-entry burn and smoke/wind effects. 3) more rubbles when they land. 4) I insist on having the
same ant-view extreme low angle with one leg of the last Mech in the foreground, as in the demo."

The demo IS the reference: `~/Documents/kainode-vault/projects/stalheart-feids26-peek/` holds its sources, read them whole before writing:
`ridgeback-drop_effects.js` (the mech's effects: 45 fire sprites, the jet cones, 42 smoke sprites on impact, the crack lines),
`feids26_viewer.js` (the capsule's heat group: the blue glow sphere + a white torus rim + 24 vertex-coloured flame trails along the shell
(radiusAt from `assets_feids26_runtime.js` PROFILE, AXIAL_STRETCH 1.4), the thermal emissive on the shell material (`feids26_shield-heat.js`),
the flash; the camera with its ground "ant" view and fov 48 -> 67; the shake), `feids26_timeline.js`.
What the game has today: `src/fx/feids-drop.js` (glow spheres: the capsule's blue sphere, an orange sphere on each mech = the owner's
"orange bubble"; jet cones; `h.explode('rock.dust')` at touchdown), `src/domain/reinforcements.js` (the pure rule incl. `dropCamera`, ground
camera 3.5 m because the game camera's near plane is 0.004 world units = ~3 m: src/td-tab.js:336 `new THREE.PerspectiveCamera(68, 1, 0.004, 50)`),
`src/fx/reinforcements-host.js` (the cut via `h.startShot({ skippable: true, poseAt })`, `h.camera` in the host), `src/fx/camera-shot.js`
(ANY keydown skips a skippable shot: the owner's screenshot problem, macOS Cmd+Shift+4/5 is a keydown).

## Decisions

1. **Screenshots (the skip rule, src/fx/camera-shot.js):** a keydown with `metaKey`, `ctrlKey` or `altKey`, or whose `key` is itself a modifier
   (Shift, Meta, Control, Alt, CapsLock, Fn), does NOT skip a shot. Every other key and every tap still skips. A node test on `skip`'s rule
   (extract the predicate `skipsOn(ev)` if the module has no test seam; keep the file's shape). Applies to every skippable shot (the disco ball's,
   the breach's own path unchanged).
2. **The capsules' burn (note 1):** port the demo's heat group per capsule in place of the lone glow sphere: the blue glow sphere (kept), the white
   torus rim at the shield, the 24 flame trails (the vertex-coloured BufferGeometry strips from viewer.js, built once, radiusAt from the PROFILE
   copied into src/fx/feids-drop.js or a small `src/fx/feids-heat.js`), pulsing as the demo pulses them (opacity x heat x (0.8 + 0.2 sin)), the
   group placed at the capsule's axis (AXIS_Y) in the capsule's own frame so the trails stream along local -Z (tail) as in the demo; the thermal
   emissive (`shield-heat.js` onBeforeCompile on a CLONE of the GLB shell material, `customProgramCacheKey`), driven by heat before the split and
   exp(-split*1.8) after; the flash kept. The capsule's own clip `Shell_Separate` stays (the demo's applyShell is not needed).
3. **The mechs' burn (note 2):** the orange sphere goes. Port the demo's 45 fire sprites per mech (the radial-gradient CanvasTexture, orange
   0xff6a16 / cream 0xffdca0 every fourth, additive, rising q*(5 + heat*8) m above the body as it falls: the burn streams UP behind a falling
   body, which reads as re-entry) in a group at the body's world point (not rotated with the mech, as the demo), plus a WIND/SMOKE trail the demo
   lacks (the owner: "a more believable mix of re-entry burn and smoke/wind effects"): 16 grey sprites (0x71695c / 0x55585a, normal blending,
   depthWrite false) above the fire, farther up (q*(9 + heat*10) m), wider (spread 1.5 + q*2), fading with (1-q), opacity 0.35*heat, pulled a
   little along -x by a constant "wind" (0.8*q m). Keep the jet cones. Everything deterministic in t (the demo's style: functions of t, no
   particle history), pooled once at begin().
4. **Rubble at touchdown (note 3):** per mech at `hit >= 0`: the demo's 42 smoke sprites (as effects.js, spread/age/opacity) and the crack line
   segments at the landing spot (local XZ plane at 0.025 m, rotated by yaw), PLUS rock chunks: 24 small chunks per mech (icosahedron 0, flat
   shaded, the planet's rock grey 0x515d64-ish or the game's crater rock colour if one is handy in src/content), launched at hit from the
   feet in a ring (deterministic per chunk: angle i*2.399, speed 6..11 m/s, up 4..8 m/s), ballistic under 9.8 m/s2 in the tangent frame,
   settling on the ground after their flight (position = max(0, y)) and staying as rubble until the scene is released (feids-drop `release()`),
   each tumbling by its flight time; and the game's dust kept (`h.explode('rock.dust')`), twice for the laggard (its impact is the heavy one).
   Scale every size by `h.metres()` as the module already does (the demo's units are metres).
5. **The ant view (note 4):** `dropCamera` returns the demo's ground camera exactly: eye (9.75, 0.2, 7.0) m, look at the laggard (7.6,
   max(0.55, height + 0.65), 5.5), fov 48 + ant*19, the lerp from the wide view over groundCamera [16.5, 18] as the demo. The near plane: while
   the cut runs the host sets `h.camera.near` to 0.00025 world units (~0.19 m) and `h.camera.fov` to the rule's fov, calling
   updateProjectionMatrix each tick, and restores both (the values it found) in the shot's onEnd and on dispose/restore. Check td-tab does not
   overwrite fov/near each frame during a shot (src/td-tab.js:425, 5233, 5259 write fov: the gunship zoom and the lab's lens; confirm none run
   during the cut; if one does, the host re-applies after it). The shake: add the demo's shake to the camera's eye (0.035*heat, 0.16*flash,
   0.22*exp(-hit*5) per impact, the laggard 0.1), damped x(1 - 0.6*ant) vertically; make it a knob `REINFORCEMENTS.shot.shake` (1 = demo).
   Keep the depth precision honest: with near 0.00025 and far 50 the ratio is 2e5; if the ground z-fights in the ant view at 19-23 s, raise near
   to 0.0004 and say so.
6. **Harness:** a browser step `--feids-shots`: from `?sw=0&acceptance=1&cine=0&intro=0&world=story&skip=defence&reinforce=1#td`, wait for
   `state().reinforcements.phase === 'dropping'`, then at the drop's clock t = 3, 7, 13, 17, 19.6 and 22 s (poll `state().reinforcements.t`)
   capture a PNG each (the harness's `Page.captureScreenshot`, write `artifacts/browser/feids-<t>.png`), assert the cut is live
   (`state().shot` is the drop's id) through 19.6 s and that `state().reinforcements.mechs` has 4 at the end. Also a `--reinforcements`
   check that a keydown with metaKey during the cut does NOT end it (CDP Input.dispatchKeyEvent with modifiers 4 = Meta... check the harness's
   key helper), while a plain key still does. `--reinforcements` and `--reinforcements-lull` must stay green.
   Look at every PNG yourself (Read the file) and judge against the demo's description before reporting: the burn must read as flames + smoke
   streaming up behind the falling body, not a ball; the ant view must have a leg in the foreground.

## Out
The leg fold in the shell, the capsules' wrecks lying, the mechs' damage, voice recordings.

## Order
1 (skip rule, test) -> 5 (camera + near + fov, --feids-shots PNGs to see the frame) -> 3 (mech burn) -> 2 (capsule burn) -> 4 (rubble) -> records.
Commit each step tested. A deban entry at the end (`npm run log -- add FILE`), STATE's paragraph short, this spec filed.
