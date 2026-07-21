-- Permite que admin crie clientes em nome de outro usuário (impersonation), igual já ocorre em SELECT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can create clientes" ON public.clientes;

CREATE POLICY "Users can create clientes" ON public.clientes
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin());
