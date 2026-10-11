// Cloudflare Worker API for FiveM Gang Auth & IP Logging
export interface Env {
  GANG_VAULT?: KVNamespace;
}

const GANG_SECRET_SEED = 'RV_Z98X_7K2Q_GANG_VAULT_SEED_2026';
const MASTER_PIN = '222547';

function hashDateToPIN(dateStr: string): string {
  const input = `${dateStr}_${GANG_SECRET_SEED}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash |= 0;
  }
  const pinNum = (Math.abs(hash) % 900000) + 100000;
  return String(pinNum);
}

function getLocalDateString(date: Date = new Date()): string {
  // Thailand UTC+7
  const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'Unknown';
    const city = request.headers.get('cf-ipcity') || '';
    const country = request.headers.get('cf-ipcountry') || 'TH';

    // Route: /api/verify
    if (url.pathname === '/api/verify' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { pin?: string; memberName?: string };
        const pin = (body.pin || '').trim();
        const memberName = (body.memberName || '').trim();

        if (!memberName) {
          return new Response(JSON.stringify({ success: false, error: 'กรุณากรอกชื่อเล่น' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const todayStr = getLocalDateString();
        const todayPin = hashDateToPIN(todayStr);

        let isMaster = false;
        let success = false;

        if (pin === MASTER_PIN) {
          isMaster = true;
          success = true;
        } else if (pin === todayPin) {
          isMaster = false;
          success = true;
        }

        const logEntry = {
          ip: clientIP,
          city,
          country,
          memberName,
          action: success ? 'login_success' : 'login_fail',
          isMaster,
          timestamp: Date.now(),
        };

        return new Response(
          JSON.stringify({
            success,
            isMaster,
            token: success ? `tok_${Date.now()}_${Math.random().toString(36).slice(2)}` : null,
            log: logEntry,
          }),
          {
            status: success ? 200 : 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Route: /api/my-ip
    if (url.pathname === '/api/my-ip') {
      return new Response(JSON.stringify({ ip: clientIP, city, country }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'ok', service: 'runthukverb-security-vault' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
