-- ============================================================================
-- Demo seed — one venue, one lobby session, a fixed question bank.
-- Safe to re-run: keyed on the venue's qr_token.
-- After running, the join URL is:  /trivia/j/anchor-demo
-- ============================================================================

-- Demo venue (stable qr_token so the join URL never changes).
insert into public.venues (name, address, qr_token)
values ('The Anchor Tavern', '12 Harbor St, Portland', 'anchor-demo')
on conflict (qr_token) do nothing;

-- One session for that venue, in the lobby, and make it the active game.
do $$
declare
  v_venue   uuid;
  v_session uuid;
begin
  select id into v_venue from public.venues where qr_token = 'anchor-demo';

  -- Only create a session if this venue has no active game yet.
  select active_session_id into v_session from public.venues where id = v_venue;
  if v_session is null then
    insert into public.sessions (venue_id, game_type, phase)
    values (v_venue, 'live_trivia', 'lobby')
    returning id into v_session;

    update public.venues set active_session_id = v_session where id = v_venue;
  end if;
end $$;

-- Fixed question bank (correct_index is 0-based into choices).
insert into public.questions (prompt, choices, correct_index, category, sort_order)
values
  ('Which planet is known as the Red Planet?',
   '["Venus","Mars","Jupiter","Mercury"]'::jsonb, 1, 'Science', 1),
  ('What is the capital of Australia?',
   '["Sydney","Melbourne","Canberra","Perth"]'::jsonb, 2, 'Geography', 2),
  ('How many strings does a standard guitar have?',
   '["Four","Five","Six","Seven"]'::jsonb, 2, 'Music', 3),
  ('In which year did the first iPhone launch?',
   '["2005","2007","2009","2010"]'::jsonb, 1, 'Tech', 4),
  ('Which element has the chemical symbol "O"?',
   '["Gold","Oxygen","Osmium","Iron"]'::jsonb, 1, 'Science', 5),
  ('Who painted the Mona Lisa?',
   '["Michelangelo","Raphael","Leonardo da Vinci","Donatello"]'::jsonb, 2, 'Art', 6),
  ('What is the largest ocean on Earth?',
   '["Atlantic","Indian","Arctic","Pacific"]'::jsonb, 3, 'Geography', 7),
  ('How many minutes are in a full day?',
   '["1200","1440","1800","2400"]'::jsonb, 1, 'Trivia', 8)
on conflict do nothing;
