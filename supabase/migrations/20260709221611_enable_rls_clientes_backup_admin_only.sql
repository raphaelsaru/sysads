ALTER TABLE public.clientes_backup_before_migration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Somente admin acessa backup de clientes"
ON public.clientes_backup_before_migration
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
