const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/edges?limit=1', { headers: { 'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }).then(r => r.json()).then(console.log);
