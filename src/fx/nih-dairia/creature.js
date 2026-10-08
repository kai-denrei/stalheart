// Ported from lab-creatures src/monster/portable.ts (kai-denrei, f2a4f89, export of 2026-10-08; derived from Jelly Baby by scottstts; GPL-3.0, see ./LICENSE), types stripped; the solver, the gait, the pursuit and the feeding are unchanged.
// Changes from the kit: model.ts is folded in as loadMonsterCage (the URLs come from NIH_DAIRIA_MODELS, resolved against document.baseURI); createNihDairia takes the variant's options ({ models, look, cage, phys }), steps with its own copy of PHYS (body.phys), calls appearance.update() after body.updateSurface(), returns the steps taken from update and records creature.timings.
import { SoftBody } from './soft-body.js';
import { PHYS } from './constants.js';
import { FixedStepper } from './fixed-step.js';
import { parseCage } from './cage-model.js';
import { MonsterBehavior } from './behavior.js';
import { createMonsterAppearance } from './appearance.js';
import { normalizeMotion } from './motion-settings.js';
import { NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS, NIH_DAIRIA_VARIANT } from '../../content/nih-dairia.js';

export async function loadMonsterCage(variant=NIH_DAIRIA_VARIANT,models=NIH_DAIRIA_MODELS){
  const [binary,metadata]=await Promise.all([
    fetch(new URL(models[variant].bin,document.baseURI)),
    fetch(new URL(models[variant].json,document.baseURI)),
  ]);
  if(!binary.ok||!metadata.ok)throw new Error('Could not load Nih-Dairia geometry');
  return parseCage(await binary.arrayBuffer(),await metadata.json());
}

/** Drop-in actor for a Three.js scene. Host owns rendering and lighting. */
export async function createNihDairia(values={},variant=NIH_DAIRIA_VARIANT,{ models=NIH_DAIRIA_MODELS, look=NIH_DAIRIA_LOOK, cage=null, phys=null }={}){
  const body=new SoftBody(cage??await loadMonsterCage(variant,models));
  const P=phys??{ ...PHYS };body.phys=P;
  const settings=normalizeMotion(values),motion=new MonsterBehavior(body,settings);
  const appearance=createMonsterAppearance(body,motion.feeding,look),mesh=appearance.mesh,clock=new FixedStepper(P.step);
  let disposed=false;
  const creature={
    mesh,body,motion,settings,appearance,phys:P,timings:{solver:0,skin:0,steps:0},
    setTarget(target){if(motion.feeding.locked)return false;motion.target.copy(target);motion.stimulus=1;return true;},
    update(dt){
      if(disposed)return 0;
      const start=performance.now();
      const steps=clock.advance(dt,()=>{motion.step(P.step);body.step(P.step);});
      const stepped=performance.now();
      if(steps){if(!body.isFinite())throw new Error('Nih-Dairia physics became non-finite');body.updateSurface();appearance.update();}
      creature.timings={solver:stepped-start,skin:performance.now()-stepped,steps};
      return steps;
    },
    reset(){motion.reset();clock.reset();appearance.update();},
    dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();body.cage.opticalSurface.geometry.dispose();},
  };
  return creature;
}
