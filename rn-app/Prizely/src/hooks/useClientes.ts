import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Cliente, NovoCliente } from '@core/types/crm'
import { clientesService } from '@services/clientes'
import { useAuth } from '@providers/AuthProvider'

const CLIENTES_QUERY_KEY = ['clientes'] as const
const ESTATISTICAS_QUERY_KEY = ['clientes', 'estatisticas'] as const

export const useClientes = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const listaQuery = useQuery({
    queryKey: CLIENTES_QUERY_KEY,
    queryFn: clientesService.listar,
    enabled: Boolean(user),
  })

  const estatisticasQuery = useQuery({
    queryKey: ESTATISTICAS_QUERY_KEY,
    queryFn: clientesService.estatisticas,
    enabled: Boolean(user),
    staleTime: 1000 * 60, // 1 minuto
  })

  const criarMutation = useMutation({
    mutationFn: clientesService.criar,
    onSuccess: (novoCliente) => {
      queryClient.setQueryData<Cliente[]>(CLIENTES_QUERY_KEY, (clientes) => {
        if (!clientes) return [novoCliente]
        return [novoCliente, ...clientes]
      })
      void queryClient.invalidateQueries({ queryKey: ESTATISTICAS_QUERY_KEY })
    },
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<NovoCliente> }) =>
      clientesService.atualizar(id, payload),
    onSuccess: (clienteAtualizado) => {
      queryClient.setQueryData<Cliente[]>(CLIENTES_QUERY_KEY, (clientes) => {
        if (!clientes) return [clienteAtualizado]
        return clientes.map((cliente) => (cliente.id === clienteAtualizado.id ? clienteAtualizado : cliente))
      })
      void queryClient.invalidateQueries({ queryKey: ESTATISTICAS_QUERY_KEY })
    },
  })

  const removerMutation = useMutation({
    mutationFn: clientesService.remover,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Cliente[]>(CLIENTES_QUERY_KEY, (clientes) => {
        if (!clientes) return []
        return clientes.filter((cliente) => cliente.id !== id)
      })
      void queryClient.invalidateQueries({ queryKey: ESTATISTICAS_QUERY_KEY })
    },
  })

  return {
    clientes: listaQuery.data ?? [],
    clientesStatus: listaQuery.status,
    clientesErro: listaQuery.error,
    estaCarregandoClientes: listaQuery.isLoading,
    estatisticas: estatisticasQuery.data,
    estaCarregandoEstatisticas: estatisticasQuery.isLoading,
    refetchClientes: listaQuery.refetch,
    criarCliente: criarMutation.mutateAsync,
    atualizarCliente: atualizarMutation.mutateAsync,
    removerCliente: removerMutation.mutateAsync,
    criandoCliente: criarMutation.isPending,
    atualizandoCliente: atualizarMutation.isPending,
    removendoCliente: removerMutation.isPending,
  }
}
