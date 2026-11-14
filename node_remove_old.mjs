import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = '.env.local';
let anon = '', url = '';
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^VITE_SUPABASE_ANON_KEY=(.+)$/.exec(line); if (m) anon = m[1].trim();
    const m2 = /^VITE_SUPABASE_URL=(.+)$/.exec(line); if (m2) url = m2[1].trim();
  }
}
const sb = createClient(url, anon);
const target = 'insp_1794294686886_mclxyzi8.webp';
const before = await sb.storage.from('inspection-images').list('', { search: target });
console.log('BEFORE count=' + (before.data ? before.data.length : 'n/a'));
const rm = await sb.storage.from('inspection-images').remove([target]);
console.log('REMOVE data=' + JSON.stringify(rm.data) + ' err=' + JSON.stringify(rm.error));
const after = await sb.storage.from('inspection-images').list('', { search: target });
console.log('AFTER count=' + (after.data ? after.data.length : 'n/a'));
