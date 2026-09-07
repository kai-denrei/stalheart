// Versioned result boundary shared by browser runner and offline reports.
export function normaliseResult(raw) {
  if (!raw || typeof raw !== 'object') throw Error('Missing simulation result');
  if (raw.schema !== undefined && raw.schema !== 2) throw Error(`Unsupported simulation schema ${raw.schema}`);
  const legacy = raw.schema === undefined;
  const r = { ...raw, biomass: raw.biomass ?? raw.credit,
    outcome: legacy && raw.outcome === 'win' ? 'legacy-win' : raw.outcome,
    curve: (raw.curve || []).map(p => ({ ...p, biomass: p.biomass ?? p.credit })) };
  if (!['loss','sector-clear','planet-win','mission-complete','timeout','stalled','legacy-win'].includes(r.outcome)) throw Error('Invalid simulation outcome');
  if(typeof r.style!=='string' || !Number.isFinite(r.seed))throw Error('Missing style/seed');
  if(r.outcome!=='stalled') {
    for(const k of ['wave','round','biomass','simT','heart','score']) if(!Number.isFinite(r[k]))throw Error(`Invalid result ${k}`);
    for(const p of r.curve)for(const k of ['w','t','heart','biomass','towers'])if(!Number.isFinite(p[k]))throw Error(`Invalid curve ${k}`);
  }
  if(!legacy && (!Number.isInteger(r.roster) || typeof r.runId!=='string' || !['sector','campaign'].includes(r.scope)))throw Error('Missing run configuration');
  return r;
}
export function acceptsResult(event, { origin, source, runId }) {
  if(event.origin!==origin || event.source!==source || event.data?.simresult?.runId!==runId)return false;
  try { normaliseResult(event.data.simresult); return true; } catch { return false; }
}
