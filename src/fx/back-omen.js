// THE BACK MOUTH RUMBLES a sector before it falls (owner, 2026-09-24: the back door "should feel slightly foreshadowed").
// Composition only: which omen is due is src/domain/back-omens.js with the numbers in src/content/sectors.js BACK_OMENS; the
// controller hands in its instruments. An omen is a tremor contact left on the radar at the mouth's bearing (it stays until the
// mouth falls, when the red BACK DOOR diamond takes its place), a quake heard from the mouth, grit and dust shaken off the rock,
// and Isao's two lines.
export function createBackOmen({ mouth, hud, sfx, explode, brief, camDist, centers, gapMs = 220 }) {
  const cells = [...(mouth?.cells ?? []), ...(mouth?.flank ?? [])];
  return {
    play(o) {
      if (!mouth || !o) return false;
      hud?.tremor(mouth.dir);
      sfx?.play('sinkhole_quake', { dist: camDist(mouth.dir) });
      // one puff at a time along the mouth and its flank: the explosion pool keeps only a few bursts of this size alive at once,
      // so a volley would end all but the last few before they were seen
      for (let i = 0; i < (o.dust ?? 0) && cells.length; i++) setTimeout(() => explode('rock.dust', centers[cells[i % cells.length]]), i * gapMs);
      brief?.(o.brief);
      return true;
    },
  };
}
