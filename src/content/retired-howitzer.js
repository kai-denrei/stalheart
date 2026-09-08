// Only used to validate old FX packages before explicit roster migration.
const SHOT=(kind,projPx,trail,projSpeed,extra={})=>({kind,projPx,trail,projSpeed,...extra});
const FX=(recipe,size,colors={},tune={})=>({recipe,size,colors,tune});
export const RETIRED_HOWITZER = { shot: SHOT('lob', 15, 8, 3.0),
    // the loudest gun on the board should have the biggest muzzle on it
    muzzle: FX(['flash', 'spark', 'ember'], 1.25, { flash: 0xfff0d0, ember: 0xff8a44 },
      { flashLife: 0.18, emberCount: 30 }),
    impact: FX('shell', 1.7, { spark: 0xffc38a }, { ringEnd: 1.25, debrisCount: 18 }) };
