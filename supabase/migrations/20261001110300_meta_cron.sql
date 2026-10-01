create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- URL e segredo vêm do Vault (criados à mão, fora do git):
--   select vault.create_secret('https://prizely.com.br/api/cron/meta-events', 'meta_cron_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
select cron.schedule('meta-events', '*/5 * * * *', $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'meta_cron_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
$job$);
