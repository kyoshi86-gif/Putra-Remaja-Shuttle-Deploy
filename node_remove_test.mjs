import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = '.env.local';
let anon = '', url = '';
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^VITE_SUPABASE_ANON_KEY=(.+)$/.exec(line);
    if (m) anon = m[1].trim();
    const m2 = /^VITE_SUPABASE_URL=(.+)$/.exec(line);
    if (m2) url = m2[1].trim();
  }
}

const supabase = createClient(url, anon);
const path = 'insp_1794294686886_mclxyzi8.webp';
console.log('URL=' + url + ' ANON_LEN=' + anon.length);
const { data, error } = await supabase.storage.from('inspection-images').remove([path]);
console.log('STORAGE_REMOVE data=' + JSON.stringify(data) + ' error=' + JSON.stringify(error));
