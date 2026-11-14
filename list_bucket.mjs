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
const { data, error } = await sb.storage.from('inspection-images').list();
console.log('LIST err=' + JSON.stringify(error) + ' count=' + (data ? data.length : 'n/a'));
if (data) for (const f of data) console.log(' - ' + f.name);
