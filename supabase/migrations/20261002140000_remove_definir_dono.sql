-- App novo usa adicionar_dono/remover_dono; definir_dono (rebaixava os outros donos) sai.
drop function if exists public.definir_dono(uuid, uuid);
