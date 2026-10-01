-- Novos perfis. 'user' passa a ser exibido como Artista (só label no app).
alter type public.user_role add value if not exists 'gestor';
alter type public.user_role add value if not exists 'vendedor';
