// Local authoring is optional. Static/release hosting has no write capability.
export function createAuthoringClient() {
  const base = new URL('./__authoring/', location.href);
  let token;
  return {
    async connect() {
      const response = await fetch(new URL('state', base), { cache: 'no-store' });
      if (response.status === 404) return null;
      if (!response.ok) throw Error('Local authoring server unavailable.');
      const state = await response.json(); if (!state.available) return null; token = state.token; return state;
    },
    async request(operation, data) {
      const response = await fetch(new URL(operation, base), { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Stalheart-Authoring': token }, body: JSON.stringify(data) });
      const value = await response.json();
      if (!response.ok) { const error = Error(value.error || 'Authoring request failed'); error.status = response.status; throw error; }
      return value;
    },
  };
}
