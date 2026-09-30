-- Isolada: ADD VALUE não pode ser usado na mesma transação em que é criado.
alter type public.user_role add value if not exists 'owner';
