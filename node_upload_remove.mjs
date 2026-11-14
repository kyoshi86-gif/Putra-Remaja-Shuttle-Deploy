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
const name = 't_remove_' + Date.now() + '.webp';
const bytes = new Uint8Array([137,80,78,71,13,10,26,10]); // fake header
const up = await sb.storage.from('inspection-images').upload(name, bytes, { contentType: 'image/webp' });
console.log('UPLOAD name=' + name + ' err=' + JSON.stringify(up.error));
const rm = await sb.storage.from('inspection-images').remove([name]);
console.log('REMOVE data=' + JSON.stringify(rm.data) + ' err=' + JSON.stringify(rm.error));
const after = await sb.storage.from('inspection-images').list('', { search: name });
console.log('AFTER_LIST count=' + (after.data ? after.data.length : 'n/a') + ' err=' + JSON.stringify(after.error));
