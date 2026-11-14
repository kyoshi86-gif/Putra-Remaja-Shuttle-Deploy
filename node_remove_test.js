const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = '.env.local';
let anon = '', url = '';
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (/^VITE_SUPABASE_ANON_KEY=(.+)$/.test(line)) anon = RegExp.$1.trim();
    if (/^VITE_SUPABASE_URL=(.+)$/.test(line)) url = RegExp.$1.trim();
  }
}

(async () => {
  console.log('URL=' + url + ' ANON_LEN=' + anon.length);
  const supabase = createClient(url, anon);
  const path = 'insp_1794294686886_mclxyzi8.webp';
  const { data, error } = await supabase.storage.from('inspection-images').remove([path]);
  console.log('STORAGE_REMOVE data=' + JSON.stringify(data) + ' error=' + JSON.stringify(error));
})();
