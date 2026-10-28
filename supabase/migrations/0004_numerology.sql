-- Numerology joins the four chart systems: saved charts may use it.
-- Its saved birth details also carry the full name at birth: {date, time, tz, place, birthName}.
alter table public.charts drop constraint if exists charts_system_check;
alter table public.charts add constraint charts_system_check
  check (system in ('gene-keys', 'human-design', 'natal', 'vedic', 'numerology'));
