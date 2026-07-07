alter table players
  add column if not exists next_md_modifier text check (next_md_modifier in ('injury', 'pecking_order'));
