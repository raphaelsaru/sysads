-- Adiciona triggers de updated_at/updated_by em negociacoes, espelhando o
-- padrao ja usado em clientes (update_clientes_updated_at + trigger_set_cliente_updated_by).
-- Reaproveita as funcoes existentes (genericas, sem logica especifica de clientes).

CREATE TRIGGER update_negociacoes_updated_at
  BEFORE UPDATE ON public.negociacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_set_negociacao_updated_by
  BEFORE UPDATE ON public.negociacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cliente_updated_by();
