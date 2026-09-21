-- Category content: 7 new category packs (General Knowledge already exists
-- as the seeded "Bar Night Classics" pack). Each game now randomly mixes
-- 2 of the 8 categories instead of the host picking one pack.

insert into public.question_packs (name, category) values
  ('Pop Culture & Entertainment', 'Pop Culture & Entertainment'),
  ('Music & Audio Rounds', 'Music & Audio Rounds'),
  ('Sports', 'Sports'),
  ('Geography & History', 'Geography & History'),
  ('Food & Drink', 'Food & Drink'),
  ('Decades Nostalgia', 'Decades Nostalgia'),
  ('Franchise Specifics', 'Franchise Specifics');

-- Pop Culture & Entertainment
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds)
select pack_id, ord, prompt, choices::jsonb, correct_index, 15 from (values
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 0, 'Which streaming service produced the show "Stranger Things"?', '["Hulu","Netflix","Disney+","Amazon Prime"]', 1),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 1, 'Who played the Joker in "The Dark Knight" (2008)?', '["Jared Leto","Jack Nicholson","Heath Ledger","Joaquin Phoenix"]', 2),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 2, 'Which singer is known as the "Queen of Pop"?', '["Madonna","Cher","Whitney Houston","Britney Spears"]', 0),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 3, 'What is the name of the coffee shop in the sitcom "Friends"?', '["Central Perk","The Grind","Java Joe''s","Coffee Bean"]', 0),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 4, 'Which fast food chain''s mascot is a red-haired clown?', '["Burger King","Wendy''s","McDonald''s","Jack in the Box"]', 2),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 5, 'Which video app is known for short viral dance videos?', '["TikTok","Snapchat","Vine","Instagram"]', 0),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 6, 'Who directed the original 1993 "Jurassic Park"?', '["George Lucas","Steven Spielberg","James Cameron","Ridley Scott"]', 1),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 7, 'Which awards show is nicknamed "the Oscars"?', '["Golden Globes","Emmy Awards","Academy Awards","Grammy Awards"]', 2),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 8, 'Stefani Joanne Angelina Germanotta is the real name of which pop star?', '["Katy Perry","Lady Gaga","Ariana Grande","Rihanna"]', 1),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 9, 'Which plumber is Nintendo''s most famous video game character?', '["Luigi","Mario","Wario","Yoshi"]', 1),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 10, 'What was Walt Disney''s first feature-length animated film (1937)?', '["Pinocchio","Fantasia","Snow White and the Seven Dwarfs","Bambi"]', 2),
  ((select id from public.question_packs where name = 'Pop Culture & Entertainment'), 11, 'Which HBO fantasy series was based on novels by George R. R. Martin?', '["The Witcher","Game of Thrones","House of the Dragon","Shadow and Bone"]', 1)
) as t(pack_id, ord, prompt, choices, correct_index);

-- Music & Audio Rounds (text-based artist/song ID — real audio clips are a future enhancement)
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds)
select pack_id, ord, prompt, choices::jsonb, correct_index, 15 from (values
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 0, 'Which artist released the song "Shape of You"?', '["Ed Sheeran","Justin Bieber","Shawn Mendes","Charlie Puth"]', 0),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 1, '"Bohemian Rhapsody" is a famous song by which British rock band?', '["The Rolling Stones","Queen","Led Zeppelin","Pink Floyd"]', 1),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 2, 'Which pop star released the album "1989"?', '["Katy Perry","Taylor Swift","Ariana Grande","Selena Gomez"]', 1),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 3, 'Reggae music, popularized by Bob Marley, originated in which country?', '["Jamaica","Trinidad","Cuba","Barbados"]', 0),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 4, 'Which artist is known as "The King of Pop"?', '["Prince","Elvis Presley","Michael Jackson","James Brown"]', 2),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 5, '"Thriller," the best-selling album of all time, was recorded by which artist?', '["Michael Jackson","Whitney Houston","Madonna","Elton John"]', 0),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 6, 'Which girl group sang "Say My Name"?', '["TLC","Spice Girls","Destiny''s Child","En Vogue"]', 2),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 7, 'A standard piano has how many keys?', '["76","88","100","64"]', 1),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 8, 'Which band released the classic rock song "Hotel California"?', '["Fleetwood Mac","Eagles","The Doobie Brothers","Boston"]', 1),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 9, 'Beyoncé got her start as the lead singer of which group?', '["TLC","Destiny''s Child","3LW","En Vogue"]', 1),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 10, 'Which artist sang "Rolling in the Deep"?', '["Adele","Amy Winehouse","Sam Smith","Duffy"]', 0),
  ((select id from public.question_packs where name = 'Music & Audio Rounds'), 11, 'Originally recorded by Bing Crosby, what is the best-selling single of all time?', '["Imagine","White Christmas","My Way","Auld Lang Syne"]', 1)
) as t(pack_id, ord, prompt, choices, correct_index);

-- Sports
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds)
select pack_id, ord, prompt, choices::jsonb, correct_index, 15 from (values
  ((select id from public.question_packs where name = 'Sports'), 0, 'How many players are on a basketball team on the court at one time?', '["4","5","6","7"]', 1),
  ((select id from public.question_packs where name = 'Sports'), 1, 'As of 2022, which country has won the most FIFA World Cup titles?', '["Germany","Argentina","Brazil","Italy"]', 2),
  ((select id from public.question_packs where name = 'Sports'), 2, 'In which sport would you perform a "slam dunk"?', '["Volleyball","Basketball","Tennis","Badminton"]', 1),
  ((select id from public.question_packs where name = 'Sports'), 3, 'How many holes are played in a standard round of golf?', '["9","18","21","24"]', 1),
  ((select id from public.question_packs where name = 'Sports'), 4, 'Which city hosted the 2016 Summer Olympics?', '["Tokyo","London","Rio de Janeiro","Beijing"]', 2),
  ((select id from public.question_packs where name = 'Sports'), 5, 'In American football, how many points is a touchdown worth before the extra point?', '["3","6","7","8"]', 1),
  ((select id from public.question_packs where name = 'Sports'), 6, 'Which tennis Grand Slam tournament is played on clay courts?', '["Wimbledon","US Open","Australian Open","French Open"]', 3),
  ((select id from public.question_packs where name = 'Sports'), 7, 'How many players are on the field for one soccer team during a match?', '["9","10","11","12"]', 2),
  ((select id from public.question_packs where name = 'Sports'), 8, 'Which boxer was known for the phrase "float like a butterfly, sting like a bee"?', '["Mike Tyson","Muhammad Ali","George Foreman","Joe Frazier"]', 1),
  ((select id from public.question_packs where name = 'Sports'), 9, 'In baseball, how many strikes make an out?', '["2","3","4","5"]', 1),
  ((select id from public.question_packs where name = 'Sports'), 10, 'Which country is credited with inventing the sport of rugby?', '["Wales","Scotland","England","Ireland"]', 2),
  ((select id from public.question_packs where name = 'Sports'), 11, 'How often are the Summer Olympic Games held?', '["Every 2 years","Every 3 years","Every 4 years","Every 5 years"]', 2)
) as t(pack_id, ord, prompt, choices, correct_index);

-- Geography & History
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds)
select pack_id, ord, prompt, choices::jsonb, correct_index, 15 from (values
  ((select id from public.question_packs where name = 'Geography & History'), 0, 'What is the capital of France?', '["Lyon","Marseille","Paris","Nice"]', 2),
  ((select id from public.question_packs where name = 'Geography & History'), 1, 'Which river is commonly cited as the longest in the world?', '["Amazon","Nile","Yangtze","Mississippi"]', 1),
  ((select id from public.question_packs where name = 'Geography & History'), 2, 'The Great Pyramid, one of the ancient wonders of the world, is located in which city?', '["Cairo","Luxor","Giza","Alexandria"]', 2),
  ((select id from public.question_packs where name = 'Geography & History'), 3, 'In which year did World War II end?', '["1943","1944","1945","1946"]', 2),
  ((select id from public.question_packs where name = 'Geography & History'), 4, 'The Sahara Desert is located on which continent?', '["Asia","Africa","South America","Australia"]', 1),
  ((select id from public.question_packs where name = 'Geography & History'), 5, 'Which country gifted the Statue of Liberty to the United States?', '["United Kingdom","France","Spain","Netherlands"]', 1),
  ((select id from public.question_packs where name = 'Geography & History'), 6, 'What is the smallest country in the world by area?', '["Monaco","San Marino","Vatican City","Liechtenstein"]', 2),
  ((select id from public.question_packs where name = 'Geography & History'), 7, 'Which wall divided Berlin from 1961 to 1989?', '["The Great Wall","The Berlin Wall","The Iron Curtain","Hadrian''s Wall"]', 1),
  ((select id from public.question_packs where name = 'Geography & History'), 8, 'Which explorer is credited with reaching the Americas in 1492?', '["Ferdinand Magellan","Vasco da Gama","Christopher Columbus","Marco Polo"]', 2),
  ((select id from public.question_packs where name = 'Geography & History'), 9, 'What is the capital of Japan?', '["Osaka","Kyoto","Tokyo","Yokohama"]', 2),
  ((select id from public.question_packs where name = 'Geography & History'), 10, 'Which mountain range is considered the boundary between Europe and Asia?', '["The Alps","The Ural Mountains","The Himalayas","The Carpathians"]', 1),
  ((select id from public.question_packs where name = 'Geography & History'), 11, 'Who was the first President of the United States?', '["Thomas Jefferson","John Adams","Benjamin Franklin","George Washington"]', 3)
) as t(pack_id, ord, prompt, choices, correct_index);

-- Food & Drink
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds)
select pack_id, ord, prompt, choices::jsonb, correct_index, 15 from (values
  ((select id from public.question_packs where name = 'Food & Drink'), 0, 'What is the main ingredient in guacamole?', '["Tomato","Avocado","Lime","Onion"]', 1),
  ((select id from public.question_packs where name = 'Food & Drink'), 1, 'Sushi originated in which country?', '["China","Thailand","Japan","Korea"]', 2),
  ((select id from public.question_packs where name = 'Food & Drink'), 2, 'A traditional croissant is made from what type of dough?', '["Shortcrust pastry","Puff/laminated pastry","Choux pastry","Filo pastry"]', 1),
  ((select id from public.question_packs where name = 'Food & Drink'), 3, 'Which spirit is the base of a traditional Margarita?', '["Vodka","Rum","Tequila","Gin"]', 2),
  ((select id from public.question_packs where name = 'Food & Drink'), 4, 'Which grain is most commonly used to brew beer?', '["Wheat","Rice","Barley","Corn"]', 2),
  ((select id from public.question_packs where name = 'Food & Drink'), 5, 'Wine is made primarily from which fruit?', '["Grapes","Apples","Berries","Plums"]', 0),
  ((select id from public.question_packs where name = 'Food & Drink'), 6, 'Pizza, made of flatbread topped with cheese and toppings, originated in which country?', '["Greece","Italy","Spain","France"]', 1),
  ((select id from public.question_packs where name = 'Food & Drink'), 7, 'Which vegetable is the main ingredient in traditional French fries?', '["Sweet potato","Potato","Yam","Parsnip"]', 1),
  ((select id from public.question_packs where name = 'Food & Drink'), 8, 'Besides rum and lime, what herb gives a mojito its signature flavor?', '["Basil","Mint","Cilantro","Rosemary"]', 1),
  ((select id from public.question_packs where name = 'Food & Drink'), 9, 'Which cheese is traditionally used on a Margherita pizza?', '["Cheddar","Parmesan","Mozzarella","Gouda"]', 2),
  ((select id from public.question_packs where name = 'Food & Drink'), 10, 'What is the main ingredient in hummus?', '["Black beans","Chickpeas","Lentils","Kidney beans"]', 1),
  ((select id from public.question_packs where name = 'Food & Drink'), 11, 'Which country is credited with originating the tradition of afternoon tea?', '["France","England","China","India"]', 1)
) as t(pack_id, ord, prompt, choices, correct_index);

-- Decades Nostalgia (80s / 90s / 2000s)
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds)
select pack_id, ord, prompt, choices::jsonb, correct_index, 15 from (values
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 0, 'Which colorful pony toy line launched in the 1980s?', '["My Little Pony","Care Bears","Transformers","Cabbage Patch Kids"]', 0),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 1, 'Nintendo''s console featuring Mario, released in 1985, was called the...?', '["Game Boy","Nintendo Entertainment System","Super Nintendo","Nintendo 64"]', 1),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 2, 'Which 1990s sitcom followed six friends living in New York City?', '["Seinfeld","Friends","Frasier","Cheers"]', 1),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 3, 'Which late-90s/2000s boy band sang "I Want It That Way"?', '["*NSYNC","Backstreet Boys","98 Degrees","Boyz II Men"]', 1),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 4, 'Which portable music device, released by Apple in 2001, changed how people listened to music?', '["Walkman","Discman","iPod","Zune"]', 2),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 5, 'Which social network launched in 2004 starting at Harvard University?', '["MySpace","Facebook","Twitter","Friendster"]', 1),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 6, 'Which 1997 James Cameron film became the highest-grossing movie of its time?', '["Titanic","Jurassic Park","Independence Day","The Matrix"]', 0),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 7, 'The rise of grunge music and bands like Nirvana is most associated with which decade?', '["1970s","1980s","1990s","2000s"]', 2),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 8, 'Which Sony console was the top-selling home video game console of the 2000s?', '["PlayStation","PlayStation 2","PlayStation 3","PSP"]', 1),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 9, 'Launched in 2000, which reality show marooned contestants on an island for a cash prize?', '["Big Brother","The Amazing Race","Survivor","Fear Factor"]', 2),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 10, 'Which 1980s film franchise features a time-traveling DeLorean?', '["Ghostbusters","Back to the Future","E.T.","The Goonies"]', 1),
  ((select id from public.question_packs where name = 'Decades Nostalgia'), 11, 'Which early-2000s social site let users decorate profiles and rank a "Top 8" friends?', '["Facebook","MySpace","Bebo","Friendster"]', 1)
) as t(pack_id, ord, prompt, choices, correct_index);

-- Franchise Specifics (Harry Potter / Marvel / Star Wars / Disney)
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds)
select pack_id, ord, prompt, choices::jsonb, correct_index, 15 from (values
  ((select id from public.question_packs where name = 'Franchise Specifics'), 0, 'Which Hogwarts house is Harry Potter sorted into?', '["Slytherin","Hufflepuff","Gryffindor","Ravenclaw"]', 2),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 1, 'In the Marvel Cinematic Universe, what metal is Captain America''s shield made of?', '["Adamantium","Vibranium","Titanium","Uru"]', 1),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 2, 'Who is revealed to be Luke Skywalker''s father in Star Wars?', '["Obi-Wan Kenobi","Emperor Palpatine","Darth Vader","Yoda"]', 2),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 3, 'Which Disney movie features a snowman named Olaf?', '["Tangled","Frozen","Moana","Encanto"]', 1),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 4, 'What is the name of Harry Potter''s pet owl?', '["Errol","Hedwig","Pigwidgeon","Fawkes"]', 1),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 5, 'Which Avenger is also known as the "God of Thunder"?', '["Iron Man","Hulk","Thor","Hawkeye"]', 2),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 6, 'Which Jedi Master says "Do or do not, there is no try"?', '["Obi-Wan Kenobi","Mace Windu","Qui-Gon Jinn","Yoda"]', 3),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 7, 'In "The Lion King," what is the name of Simba''s father?', '["Scar","Mufasa","Zazu","Rafiki"]', 1),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 8, 'What is the name of the wizarding school Harry Potter attends?', '["Beauxbatons","Durmstrang","Ilvermorny","Hogwarts"]', 3),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 9, 'Which Infinity Stone is associated with the color red in the MCU?', '["Space Stone","Reality Stone","Power Stone","Time Stone"]', 1),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 10, 'What is the name of Han Solo''s ship in Star Wars?', '["Slave I","Ghost","Millennium Falcon","Star Destroyer"]', 2),
  ((select id from public.question_packs where name = 'Franchise Specifics'), 11, 'Which Disney princess has a pet tiger named Rajah?', '["Belle","Jasmine","Pocahontas","Mulan"]', 1)
) as t(pack_id, ord, prompt, choices, correct_index);

-- ---------- Games now mix 2 random categories instead of one host-picked pack ----------

create table public.room_questions (
  room_id uuid not null references public.rooms(id) on delete cascade,
  order_index int not null,
  question_id uuid not null references public.questions(id),
  primary key (room_id, order_index)
);
alter table public.room_questions enable row level security;
create policy "room_questions readable" on public.room_questions for select using (true);

drop function public.advance_phase(uuid, uuid, text);
drop function public.submit_answer(uuid, uuid, uuid, uuid, smallint);
drop function public.create_room(uuid, timestamptz);

alter table public.rooms drop column pack_id;

create function public.create_room(p_starts_at timestamptz default null, p_questions_per_category int default 10)
returns table(room_id uuid, code text, host_secret uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_room public.rooms;
  v_secret uuid;
  v_cat1 uuid;
  v_cat2 uuid;
  v_question_ids uuid[];
begin
  select id into v_cat1 from public.question_packs order by random() limit 1;
  select id into v_cat2 from public.question_packs where id <> v_cat1 order by random() limit 1;

  select array_agg(id) into v_question_ids from (
    (select id from public.questions where pack_id = v_cat1 order by random() limit p_questions_per_category)
    union all
    (select id from public.questions where pack_id = v_cat2 order by random() limit p_questions_per_category)
  ) picked;

  select array_agg(x order by random()) into v_question_ids from unnest(v_question_ids) as x;

  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    begin
      insert into public.rooms (code, starts_at) values (v_code, p_starts_at)
      returning * into v_room;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.room_hosts (room_id) values (v_room.id)
    returning room_hosts.host_secret into v_secret;

  insert into public.room_questions (room_id, order_index, question_id)
  select v_room.id, ord - 1, qid
  from unnest(v_question_ids) with ordinality as t(qid, ord);

  return query select v_room.id, v_room.code, v_secret;
end;
$$;

create function public.advance_phase(p_room_id uuid, p_host_secret uuid, p_action text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_correct smallint;
  v_total int;
begin
  perform 1 from public.room_hosts where room_id = p_room_id and host_secret = p_host_secret;
  if not found then raise exception 'NOT_AUTHORIZED_OR_NOT_FOUND'; end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'NOT_AUTHORIZED_OR_NOT_FOUND'; end if;

  if p_action = 'reveal' then
    select q.correct_index into v_correct
      from public.room_questions rq join public.questions q on q.id = rq.question_id
      where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
    update public.rooms set phase = 'reveal', revealed_correct_index = v_correct where id = p_room_id;

  elsif p_action = 'leaderboard' then
    update public.rooms set phase = 'leaderboard' where id = p_room_id;

  elsif p_action = 'next_question' then
    select count(*) into v_total from public.room_questions where room_id = p_room_id;
    if v_room.current_question_index + 1 >= v_total then
      update public.rooms set phase = 'final' where id = p_room_id;
    else
      update public.rooms set
        phase = 'question',
        current_question_index = v_room.current_question_index + 1,
        question_started_at = now(),
        revealed_correct_index = null
      where id = p_room_id;
    end if;

  elsif p_action = 'end' then
    update public.rooms set phase = 'final' where id = p_room_id;
  else
    raise exception 'UNKNOWN_ACTION';
  end if;
end;
$$;

create function public.submit_answer(
  p_room_id uuid, p_player_id uuid, p_client_token uuid,
  p_question_id uuid, p_choice_index smallint
)
returns table(correct boolean, points_awarded int)
language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_question public.questions;
  v_expected_question_id uuid;
  v_elapsed_ms int;
  v_correct boolean;
  v_points int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.phase <> 'question' then raise exception 'NOT_ACCEPTING_ANSWERS'; end if;

  perform 1 from public.players
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;

  select question_id into v_expected_question_id from public.room_questions
    where room_id = p_room_id and order_index = v_room.current_question_index;
  if v_expected_question_id is null or v_expected_question_id <> p_question_id then
    raise exception 'STALE_QUESTION';
  end if;

  select * into v_question from public.questions where id = p_question_id;

  v_elapsed_ms := greatest(0, extract(epoch from (now() - v_room.question_started_at)) * 1000)::int;
  if v_elapsed_ms > (v_question.time_limit_seconds * 1000 + 1500) then
    raise exception 'TIME_EXPIRED';
  end if;

  v_correct := (p_choice_index = v_question.correct_index);
  v_points := 0;
  if v_correct then
    v_points := 500 + greatest(0, round(500 * (1 - v_elapsed_ms::numeric / (v_question.time_limit_seconds * 1000))))::int;
  end if;

  insert into public.answers (room_id, question_id, player_id, choice_index, correct, points_awarded)
    values (p_room_id, p_question_id, p_player_id, p_choice_index, v_correct, v_points)
    on conflict (question_id, player_id) do nothing;

  if not found then
    select a.correct, a.points_awarded into v_correct, v_points
      from public.answers a where a.question_id = p_question_id and a.player_id = p_player_id;
    return query select v_correct, v_points;
    return;
  end if;

  update public.players set score = score + v_points where id = p_player_id;

  return query select v_correct, v_points;
end;
$$;

grant execute on function public.create_room(timestamptz, int) to anon, authenticated;
grant execute on function public.advance_phase(uuid, uuid, text) to anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, uuid, uuid, smallint) to anon, authenticated;
