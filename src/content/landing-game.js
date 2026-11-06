// THE LANDING's tune, the content-layer name for it (owner, 2026-11-07). The literal lives in src/core/landing-game.js because the
// flight model in src/domain/manual-landing.js defaults to it and the architecture guard bars domain from importing content;
// everything else imports it from here, as the plan names it.
export { LANDING_GAME } from '../core/landing-game.js';
