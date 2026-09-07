# Next lab task: A6 missile kit

Owner direction, 2026-09-07: restart with only Stalheart, then use the animation from https://jelaludo.github.io/SentryTowers_A6/missile-lab/ for the numbered Sentries.

| Subject | Accepted direction |
| --- | --- |
| 3. Quiver | Animated rocket; lowest practical triangle count and small game rendering size |
| 8. Heptapod | Same motion family with a larger rocket; size does not require a heavier mesh |
| Main tank shells | Explore the rocket mesh without the authored flight animation; not yet a committed replacement |

Upstream integration notes inspected on 2026-09-07: https://jelaludo.github.io/SentryTowers_A6/assets/missile-kit/README.md. These are mutable upstream observations, not a pinned asset import. No new missile asset or behavior is installed yet.

- DART: 188 triangles including optional exhaust, four material batches. Start here for Quiver and assess the same mesh at larger scale for Heptapod.
- NEEDLE: 456 triangles, six batches; TALON: 1,340 triangles, seven batches. These are projectile variants, independent of the retired Sentry tower families with similar names.
- All bodies share a 1.49 m envelope, +Y up / +Z forward. Mesh detail and timing are independent.
- Clips: Flight_swift (1.35 s), Flight_hook (2.70 s), Flight_heavy (4.00 s). The owner chose the motion language, not a final timing preset.
- Motion: unpowered pop, arc and fall; ignition; climb; hook; accelerated dive. Ignition starts at 32% of normalized flight time.
- ROOT → MISSILE_MOTION owns the body; TIP_SOCKET and EXHAUST_SOCKET expose attachment points. EXHAUST_FX is optional.
- The reusable missile-lab/flight.mjs sampler exports normalized position, nose direction, ignition and phase. Nose direction is independent of falling travel during the unpowered opening.

## First implementation slice

Pin the source revision and assets with hashes before integrating. Adapt the pure sampler through a shared projectile presentation module used by the Sentry/Impact labs and game. Preserve Stalheart's single vendored Three.js version; do not copy the remote viewer's CDN renderer dependency.

Author size, timing and exhaust in labs, then export through the existing validated content workflow. Keep triangle budget, material batches, active instances and trail/exhaust cost visible in measurements. Match the small in-game silhouette before adding detail.

The baked flight ends at the launch elevation and has a fixed path. Map presentation onto the sphere and actual target interception; do not let visual clip duration replace damage, guidance, hit detection or targeting rules. Detach each launch from the rotating turret, use the authored muzzle transform, pool/release per-shot resources, and suppress exhaust before ignition and after arrival. For the tank candidate, use the static mesh on the existing shell trajectory without playing the authored flight clip.

Acceptance: both numbered Sentries use one shared motion implementation in lab and game; Quiver remains legible at small scale; Heptapod is visibly larger; target movement and curved-surface arrivals stay correct; sustained firing has bounded memory and draw calls; tank-shell reuse remains optional pending visual review.
