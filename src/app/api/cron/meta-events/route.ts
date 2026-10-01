import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { processarOutbox } from '@/lib/meta-outbox'

// Chamado a cada 5 min pelo pg_cron + pg_net do Supabase (Vercel Hobby só tem cron diário).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const resultado = await processarOutbox(createAdminClient())
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    console.error('cron meta-events', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 })
  }
}
