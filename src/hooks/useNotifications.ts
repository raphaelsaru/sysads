'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Cliente } from '@/types/crm'

const supabase = createClient()

export interface LeadNotification {
  id: string
  nome: string
  whatsappInstagram: string
  dataLembrete: string
  resultado: Cliente['resultado']
}

export interface NotificationGroup {
  hoje: LeadNotification[]
  amanha: LeadNotification[]
  proximos: LeadNotification[]
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationGroup>({
    hoje: [],
    amanha: [],
    proximos: [],
  })
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const carregarNotificacoes = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.warn('⚠️ Usuário não autenticado para notificações')
        return
      }

      // Calcular datas
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      
      const amanha = new Date(hoje)
      amanha.setDate(amanha.getDate() + 1)
      
      const tresDiasDepois = new Date(hoje)
      tresDiasDepois.setDate(tresDiasDepois.getDate() + 3)

      // Buscar leads com data_lembrete_chamada nos próximos 3 dias
      const { data: leads, error } = await supabase
        .from('clientes')
        .select('id, nome, whatsapp_instagram, data_lembrete_chamada, resultado')
        .eq('user_id', user.id)
        .not('data_lembrete_chamada', 'is', null)
        .gte('data_lembrete_chamada', hoje.toISOString().split('T')[0])
        .lte('data_lembrete_chamada', tresDiasDepois.toISOString().split('T')[0])
        .order('data_lembrete_chamada', { ascending: true })

      if (error) {
        console.error('❌ Erro ao carregar notificações:', error)
        return
      }

      if (!leads || leads.length === 0) {
        setNotifications({ hoje: [], amanha: [], proximos: [] })
        setTotalCount(0)
        return
      }

      // Agrupar leads por período
      const hojeStr = hoje.toISOString().split('T')[0]
      const amanhaStr = amanha.toISOString().split('T')[0]

      const hojeLeads: LeadNotification[] = []
      const amanhaLeads: LeadNotification[] = []
      const proximosLeads: LeadNotification[] = []

      for (const lead of leads) {
        const leadFormatada: LeadNotification = {
          id: lead.id,
          nome: lead.nome,
          whatsappInstagram: lead.whatsapp_instagram,
          dataLembrete: lead.data_lembrete_chamada,
          resultado: lead.resultado as Cliente['resultado'],
        }

        if (lead.data_lembrete_chamada === hojeStr) {
          hojeLeads.push(leadFormatada)
        } else if (lead.data_lembrete_chamada === amanhaStr) {
          amanhaLeads.push(leadFormatada)
        } else {
          proximosLeads.push(leadFormatada)
        }
      }

      setNotifications({
        hoje: hojeLeads,
        amanha: amanhaLeads,
        proximos: proximosLeads,
      })
      setTotalCount(hojeLeads.length + amanhaLeads.length + proximosLeads.length)

      console.log('✅ Notificações carregadas:', {
        hoje: hojeLeads.length,
        amanha: amanhaLeads.length,
        proximos: proximosLeads.length,
      })
    } catch (error) {
      console.error('❌ Erro ao carregar notificações:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregarNotificacoes()

    // Recarregar notificações a cada 5 minutos
    const interval = setInterval(() => {
      void carregarNotificacoes()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [carregarNotificacoes])

  return {
    notifications,
    loading,
    totalCount,
    recarregar: carregarNotificacoes,
  }
}

