// A baked story planet: the pinned kernel's relaxed vertices and carve for one
// recipe, so a page loads them instead of spending seconds relaxing 16,000
// points and carving 384 rooms. Pure encode/decode; the file is
//   uint32 header length, JSON header, then the typed sections it names.
// The header carries the recipe it was baked from: a bake for another recipe
// is refused and the planet is built the slow way, so a stale file can never
// change the world.
const MAGIC = 'SHBAKE1';
const TYPES = { f32: Float32Array, u8: Uint8Array, u16: Uint16Array, i32: Int32Array };

export function bakeKey(recipe) {
  const { seed, points, k, relaxIters, pullRate, rooms, roomRadius, extraCorridors, corridorWidth } = recipe;
  return JSON.stringify({ seed, points, k, relaxIters, pullRate, rooms, roomRadius, extraCorridors, corridorWidth });
}

// mesh: the relaxed kernel mesh; dungeon: the kernel's carve on it
export function encodePlanetBake(recipe, mesh, dungeon) {
  const vertices = new Float32Array(mesh.vertices.length * 3);
  mesh.vertices.forEach((v, i) => { vertices[i * 3] = v[0]; vertices[i * 3 + 1] = v[1]; vertices[i * 3 + 2] = v[2]; });
  const sections = [['vertices', 'f32', vertices], ['tags', 'u8', Uint8Array.from(dungeon.tags)], ['distToHeart', 'u16', Uint16Array.from(dungeon.distToHeart, (d) => (d < 0 ? 65535 : d))]];
  const header = { magic: MAGIC, key: bakeKey(recipe), vertices: mesh.vertices.length, cells: dungeon.tags.length, heart: dungeon.heart, spawn: dungeon.spawn, seeds: Array.from(dungeon.seeds), sections: {} };
  let offset = 0;
  for (const [name, type, arr] of sections) { offset = Math.ceil(offset / 4) * 4; header.sections[name] = { type, offset, length: arr.length }; offset += arr.byteLength; }
  const head = new TextEncoder().encode(JSON.stringify(header));
  const headLen = Math.ceil(head.length / 4) * 4;
  const out = new Uint8Array(4 + headLen + offset);
  new DataView(out.buffer).setUint32(0, headLen, true); out.set(head, 4);
  for (const [name, , arr] of sections) out.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), 4 + headLen + header.sections[name].offset);
  return out;
}

// returns null for anything that is not a bake of this recipe
export function decodePlanetBake(bytes, recipe) {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headLen = view.getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headLen)).replace(/\0+$/, ''));
    if (header.magic !== MAGIC || header.key !== bakeKey(recipe)) return null;
    const base = bytes.byteOffset + 4 + headLen;
    const read = (name) => { const s = header.sections[name]; return new TYPES[s.type](bytes.buffer, base + s.offset, s.length); };
    return { key: header.key, cells: header.cells, heart: header.heart, spawn: header.spawn, seeds: header.seeds, vertices: read('vertices'), tags: read('tags'), distToHeart: read('distToHeart') };
  } catch { return null; }
}
