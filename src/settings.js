import { exportRecords, importRecords } from './storage.js';
import { downloadJSON } from './diagnostics.js';
const status = document.getElementById('settings-status');
const act = fn => { try { fn(); } catch (e) { status.textContent = e.message; } };
document.getElementById('export-records').onclick = () => act(() => downloadJSON(exportRecords(), 'stalheart-records.json'));
document.getElementById('import-legacy').onclick = () => act(() => {
  status.textContent = `Imported ${importRecords(exportRecords(localStorage, true))} missing records. Existing records preserved.`;
});
document.getElementById('import-records').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 2000000) { status.textContent = 'Record file is too large.'; return; }
  try { status.textContent = `Imported ${importRecords(JSON.parse(await file.text()))} missing records.`; }
  catch (err) { status.textContent = err.message; }
};
document.getElementById('export-diagnostics').onclick = () => act(() => {
  const raw = sessionStorage.getItem('stalheart:diagnostics');
  if (!raw) { status.textContent = 'Open a game in this tab first, then return to settings.'; return; }
  downloadJSON(JSON.parse(raw), 'stalheart-diagnostics.json');
});
