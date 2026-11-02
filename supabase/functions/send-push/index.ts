// Edge Function: manda el aviso al celular cuando se crea una fila en public.notifications.
// Se llama desde un Database Webhook (INSERT en notifications).
// Secretos que necesita (Project Settings → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen puestas por Supabase.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
webpush.setVapidDetails('https://semmarcomoya-jpg.github.io/Multiservicesweb/', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  let body: { type?: string; table?: string; record?: { user_id?: string; title?: string; body?: string; link?: string; id?: string } } = {};
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const r = body.record;
  if (body.table !== 'notifications' || body.type !== 'INSERT' || !r?.user_id) return new Response('skip');

  const { data: subs } = await sb.from('push_subs').select('id, endpoint, p256dh, auth').eq('user_id', r.user_id);
  const payload = JSON.stringify({ title: String(r.title || 'Castillo Multiservices').slice(0, 120), body: String(r.body || '').slice(0, 300), link: String(r.link || ''), tag: r.id });
  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // El equipo ya no existe o quitó el permiso: se borra
      if (code === 404 || code === 410) await sb.from('push_subs').delete().eq('id', s.id);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'content-type': 'application/json' } });
});
