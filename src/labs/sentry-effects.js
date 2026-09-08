// Effect authoring edits the same package the range fires and exports.
import { IMPACT_TUNE, IMPACT_KNOBS, IMPACT_FAMILIES, IMPACT_RECIPES } from '../content/impact-schema.js';
export function mountSentryEffects(gui, profile) {
  const state = { effectSlot: 'impact', effectRecipe: 'shell', effectSize: 1, ...IMPACT_TUNE };
  const folder = gui.addFolder('muzzle / impact').close();
  const slot = () => profile()[state.effectSlot];
  const groups = {};
  function refresh() {
    const fx = slot(), names = Array.isArray(fx.recipe) ? fx.recipe : IMPACT_RECIPES[fx.recipe];
    state.effectRecipe = Array.isArray(fx.recipe) ? 'custom' : fx.recipe;
    state.effectSize = fx.size;
    Object.assign(state, IMPACT_TUNE, fx.tune);
    for (const name of IMPACT_FAMILIES) state[`use_${name}`] = names.includes(name);
    folder.controllersRecursive().forEach(c => c.updateDisplay());
    for (const [name, group] of Object.entries(groups)) group.show(names.includes(name));
  }
  folder.add(state, 'effectSlot', { Impact: 'impact', Muzzle: 'muzzle' }).name('edit effect').onChange(refresh);
  folder.add(state, 'effectRecipe', [...Object.keys(IMPACT_RECIPES), 'custom']).name('recipe').onChange(value => {
    slot().recipe = value === 'custom' ? IMPACT_FAMILIES.filter(n => state[`use_${n}`]) : value;
    refresh();
  });
  folder.add(state, 'effectSize', 0, 4, 0.05).name('effect size').onChange(value => { slot().size = value; });
  const families = folder.addFolder('effect components').close();
  for (const name of IMPACT_FAMILIES) {
    state[`use_${name}`] = false;
    families.add(state, `use_${name}`).name(name).onChange(() => {
      slot().recipe = IMPACT_FAMILIES.filter(n => state[`use_${n}`]); refresh();
    });
  }
  for (const k of IMPACT_KNOBS) {
    const group = groups[k.group] ||= folder.addFolder(k.group).close();
    group.add(state, k.key, k.min, k.max, k.step).name(k.label).onChange(value => {
      if (value === IMPACT_TUNE[k.key]) delete slot().tune[k.key];
      else slot().tune[k.key] = value;
    });
  }
  refresh();
  return { refresh };
}

export const EFFECT_HELP = {
  effectSlot: 'Choose which part of the selected Sentry to edit: the launch at its muzzle or the effect when its projectile arrives.',
  effectRecipe: 'Choose a combination of effects. Custom lets you enable each component separately. Changes belong to this Sentry only.',
  effectSize: 'Scale the complete selected effect. Zero hides it. This does not change damage or the projectile size.',
  ...Object.fromEntries(IMPACT_FAMILIES.map(n => [`use_${n}`, `Include ${n} in the selected muzzle or impact recipe. Turning every component off produces no effect.`])),
  sparkCount: 'Number of hot chips emitted by each hit.', sparkSpeed: 'Initial speed of sparks away from the surface.',
  sparkSpread: 'Spark cone angle in radians. Larger values spread chips across a wider fan.',
  sparkLife: 'How long sparks remain visible, in seconds.', sparkGravity: 'Acceleration pulling sparks down in the effect frame.',
  sparkBounce: 'Fraction of spark speed retained after a bounce.', sparkSize: 'Size of each spark point in pixels.',
  flashLife: 'Duration of the initial bright flash, in seconds.', flashSize: 'Radius scale of the initial flash.',
  flashRings: 'Number of overlapping layers in the flash.', ringLife: 'Duration of the expanding shockwave ring, in seconds.',
  ringEnd: 'Final radius of the shockwave ring.', ringWidth: 'Thickness of the shockwave ring.',
  scorchLife: 'How long the mark remains on the target surface, in seconds.', scorchSize: 'Scale of the scorch mark.',
  debrisCount: 'Number of solid fragments ejected by the hit.', debrisSpeed: 'Initial speed of the fragments.',
  debrisLife: 'How long fragments remain visible, in seconds.', debrisSize: 'Size of the solid fragments.',
  splashCount: 'Number of molten blobs in the splash.', splashLife: 'Duration of the splash, in seconds.',
  splashCling: 'How much splash motion stops on contact. Higher values cling more strongly.',
  splashSag: 'Acceleration making attached splash droop down the surface.', emberCount: 'Number of drifting glowing motes.',
  emberLife: 'How long embers remain visible, in seconds.', emberRise: 'Upward drift speed of embers; negative values sink.',
  emberDrag: 'Velocity retention for embers. Lower values slow them more quickly.',
};
