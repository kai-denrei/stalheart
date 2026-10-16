// THE TANK'S SHELL LANDS (owner, 2026-10-13: "the tank shell should feel and be more powerful. a) give it a stronger AoE and dmg"; then "make the
// Tank Shell impact/explosion the same as the 40mm from the Gunship, more intensity, it must feel powerful"). The damage is src/domain/shell-blast.js
// over src/content/tank.js SHELL_BLAST; the landing is the 40 mm's (src/fx/gunship-auto.js and src/sentry-pilot.js land a Bofors round the same way:
// its shock rings, its burst, its report), at the shell's radius and hotter: 'tank.blast' and the 'tank.flash' pop (src/content/explosions.js).
// A shell on a wall bursts the same without the damage (the controller's blastWall: explode('tank.blast')).
//   land(pos, struck, tNow, from)   pos the shell (unit sphere), struck the body it touched or null, from the hull's position -> { jolt } the
//                                   radius (m) of the body whose touch the hull's jolt should feel like (src/fx/ram-jolt.js; 0: none, too far)
//   last()                          the harness's record of the latest landing
import { makeDotBurst } from '../units.js';
import { norm3, dist3 } from '../vec3.js';
import { shellHits } from '../domain/shell-blast.js';
import { SHELL_BLAST } from '../content/tank.js';
import { groundAt } from './lance-follow.js';   /* the body's drawn point (2026-10-16): a shell counts against the body the player sees, not its record */

export function createShellBlast(host, tune = SHELL_BLAST) {
  let last = null;
  function land(pos, struck, tNow, from = null) {
    const cs = host.cellSide(), r = tune.radius * cs, at = norm3(pos);
    const inside = host.enemies.filter((e) => e.alive && dist3(pos, groundAt(e)) < r).length;
    const hits = shellHits(host.enemies, pos, struck, tune, cs, dist3, groundAt);
    for (const { e, dmg } of hits) host.damageEnemy(e, tNow, dmg, e === struck, 'tank');
    const ci = host.cellIndex()(at);
    if (ci !== -1) for (const [hex, life, k] of tune.rings) host.warnRing(ci, hex, life, r * k);
    const exploded = host.explode('tank.blast', at), flashed = tune.flash ? host.explode('tank.flash', at) : false;
    if (!exploded) { const b = makeDotBurst(0xffd08a, at, 44); b.scale.setScalar(cs * 0.5 * tune.radius / 2.2); b.position.set(pos[0], pos[1], pos[2]); host.scene.add(b); host.debris.push(b); }   // the 40 mm's own stand-in, should the adapter be off
    host.sfx.play('blast_fire', { dist: host.camDist(pos), rate: tune.rate });
    const near = from ? dist3(from, pos) / cs : Infinity, jolt = tune.kick ? tune.kick.metres * Math.max(0, 1 - near / tune.kick.cells) : 0;
    last = { radius: tune.radius, inside, hurt: hits.length, killed: hits.filter((h) => !h.e.alive).length, dmg: +hits.reduce((n, h) => n + h.dmg, 0).toFixed(3),
      rings: ci !== -1 ? tune.rings.map(([, , k]) => +(tune.radius * k).toFixed(3)) : [], exploded, flashed, jolt: +jolt.toFixed(3) };
    return { jolt };
  }
  return { land, last: () => last };
}
