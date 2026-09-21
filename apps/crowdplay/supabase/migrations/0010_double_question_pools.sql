-- Doubles every category's question pool from 20 to 40 original questions
-- (order_index 20-39), so a game actually rotates instead of drawing the
-- exact same 20 every time a category wins the vote (see the trade-off
-- noted in 0009). External sources were ruled out for this pass: opentdb.com
-- and the-trivia-api.com are both unreachable from this environment's
-- egress policy, and the-trivia-api's content is CC BY-NC (non-commercial
-- only) anyway, which doesn't fit a paid venue product. All 160 questions
-- below are original content, matching the style of the existing bank.

-- General Knowledge (Bar Night Classics)
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('11111111-1111-1111-1111-111111111111', 20, 'Which is the largest ocean on Earth?', '["Pacific Ocean","Atlantic Ocean","Indian Ocean","Arctic Ocean"]', 0, 15),
('11111111-1111-1111-1111-111111111111', 21, 'What is the tallest mountain in the world?', '["K2","Mount Everest","Denali","Kilimanjaro"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 22, 'How many colors are traditionally listed in a rainbow?', '["5","6","7","8"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 23, 'What is the smallest prime number?', '["0","1","2","3"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 24, 'Which language has the most native speakers worldwide?', '["English","Spanish","Mandarin Chinese","Hindi"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 25, 'What is the official currency of Japan?', '["Won","Yuan","Yen","Ringgit"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 26, 'What is the chemical formula for table salt?', '["H2O","NaCl","CO2","KCl"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 27, 'What is the largest mammal in the world?', '["African elephant","Blue whale","Giraffe","Polar bear"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 28, 'What is the largest fish in the world?', '["Great white shark","Whale shark","Manta ray","Tuna"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 29, 'How many degrees are in a right angle?', '["45","90","180","360"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 30, 'Which is the largest planet in our solar system?', '["Saturn","Jupiter","Neptune","Earth"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 31, 'What is the hardest naturally occurring substance on Earth?', '["Quartz","Titanium","Diamond","Granite"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 32, 'Which vitamin does the body produce when skin is exposed to sunlight?', '["Vitamin C","Vitamin D","Vitamin B12","Vitamin A"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 33, 'What is the capital of Canada?', '["Toronto","Vancouver","Ottawa","Montreal"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 34, 'How many teeth does a full set of adult human teeth have?', '["28","30","32","34"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 35, 'Which instrument is used to measure atmospheric pressure?', '["Thermometer","Barometer","Hygrometer","Seismograph"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 36, 'What is the most abundant gas in the sun?', '["Helium","Oxygen","Hydrogen","Nitrogen"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 37, 'How many jurors typically sit on a US criminal trial jury?', '["6","9","12","15"]', 2, 15),
('11111111-1111-1111-1111-111111111111', 38, 'What is the tallest land animal in the world?', '["Elephant","Giraffe","Camel","Moose"]', 1, 15),
('11111111-1111-1111-1111-111111111111', 39, 'Which metal is liquid at room temperature?', '["Iron","Lead","Mercury","Tin"]', 2, 15);

-- Sports
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('5bb77f53-0701-40ad-af54-375e1266d925', 20, 'How many players are on a baseball team on the field at once?', '["8","9","10","11"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 21, 'In tennis, what is a score of zero called?', '["Nil","Love","Deuce","Ace"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 22, 'How many rings are on the Olympic flag?', '["4","5","6","7"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 23, 'Which country hosted the 2016 Summer Olympics?', '["China","United Kingdom","Brazil","Japan"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 24, 'In American football, how many points is a touchdown worth before the extra point?', '["3","6","7","8"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 25, 'Which sport is traditionally played at Wimbledon?', '["Golf","Tennis","Cricket","Rugby"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 26, 'How many periods are in a standard NHL hockey game?', '["2","3","4","5"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 27, 'What is the maximum possible score in ten-pin bowling?', '["200","250","300","350"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 28, 'Which sport uses a shuttlecock?', '["Tennis","Squash","Badminton","Table Tennis"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 29, 'How many players are on a volleyball team on the court per side?', '["5","6","7","8"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 30, 'In golf, what is a score of one under par on a hole called?', '["Bogey","Birdie","Eagle","Albatross"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 31, 'Which country is credited with inventing modern rugby?', '["Wales","Ireland","England","Scotland"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 32, 'How many quarters make up a standard NBA basketball game?', '["2","3","4","5"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 33, 'What is it called when a player scores three goals in a single soccer match?', '["Grand Slam","Hat-trick","Triple Play","Trifecta"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 34, 'Which country won the first-ever FIFA World Cup in 1930?', '["Brazil","Argentina","Uruguay","Italy"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 35, 'In boxing, how many minutes long is a standard round?', '["2","3","4","5"]', 1, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 36, 'How many players are on a rugby union team on the field per side?', '["11","13","15","17"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 37, 'Which flag signals the end of a Formula 1 race?', '["Yellow flag","Red flag","Checkered flag","Green flag"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 38, 'Which Olympic event combines swimming, cycling, and running?', '["Decathlon","Pentathlon","Triathlon","Biathlon"]', 2, 15),
('5bb77f53-0701-40ad-af54-375e1266d925', 39, 'How many holes make up the front nine of a standard golf course?', '["8","9","10","11"]', 1, 15);

-- Decades Nostalgia
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 20, 'Which Nintendo handheld console, released in 1989, popularized portable gaming?', '["Game Boy","Game Gear","Atari Lynx","PlayStation Portable"]', 0, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 21, 'Which 1980s toy line features robots that disguise themselves as vehicles?', '["Transformers","GoBots","Voltron","Power Rangers"]', 0, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 22, 'Which decade is most associated with the rise of disco music?', '["1960s","1970s","1980s","1990s"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 23, 'Which blue video game hedgehog debuted for Sega in 1991?', '["Sonic the Hedgehog","Crash Bandicoot","Bomberman","Kirby"]', 0, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 24, 'Which 1990s toy craze involved collecting small cardboard discs traded and stacked in games?', '["Beanie Babies","Pogs","Tamagotchis","Pokemon cards"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 25, 'Which company released the first iPhone in 2007?', '["Samsung","Apple","Nokia","Motorola"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 26, 'Which 1980s TV show featured a talking car named KITT?', '["Knight Rider","The A-Team","Airwolf","MacGyver"]', 0, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 27, 'Which decade saw the 1981 launch of MTV?', '["1970s","1980s","1990s","2000s"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 28, 'Which search engine was a dominant player in the 1990s before Google took over?', '["Bing","Yahoo","DuckDuckGo","Safari"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 29, 'Which 2000s social platform limited posts to 140 characters?', '["Facebook","Twitter","Instagram","Snapchat"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 30, 'Which 1980s film franchise follows a whip-wielding archaeologist?', '["Indiana Jones","Tomb Raider","National Treasure","The Mummy"]', 0, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 31, 'Which portable cassette player, released by Sony, defined 1980s music listening?', '["Discman","Walkman","iPod","Boombox"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 32, 'Which 1990s/2000s boy band sang "Bye Bye Bye"?', '["Backstreet Boys","NSYNC","98 Degrees","Boyz II Men"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 33, 'Which classic arcade game from 1980 features a yellow character eating dots while avoiding ghosts?', '["Donkey Kong","Space Invaders","Pac-Man","Frogger"]', 2, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 34, 'Which instant messaging platform was popular with teens in the early 2000s, known for "away messages"?', '["WhatsApp","AIM","Skype","iMessage"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 35, 'In which decade did "The Simpsons" first premiere on television?', '["1970s","1980s","1990s","2000s"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 36, 'Which decade is known for the fashion trend of parachute pants and leg warmers?', '["1970s","1980s","1990s","2000s"]', 1, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 37, 'Which decade popularized the boy band and girl group pop explosion?', '["1970s","1980s","1990s","2000s"]', 2, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 38, 'Which classic board game challenges players to solve a murder mystery in a mansion?', '["Clue","Risk","Monopoly","Battleship"]', 0, 15),
('3b3c7777-e050-4c75-8df8-e6f2be37db94', 39, 'Which photo-sharing app, launched in 2010 and later bought by Facebook, popularized photo filters?', '["Snapchat","Instagram","Pinterest","Flickr"]', 1, 15);

-- Franchise Specifics
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('2059476b-d501-47b9-b6ce-f08267efd2e5', 20, 'In "The Lord of the Rings," what is the name of Frodo''s home region?', '["Mordor","The Shire","Rivendell","Gondor"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 21, 'Which wizard, played by Ian McKellen, leads the Fellowship in "The Lord of the Rings"?', '["Saruman","Gandalf","Dumbledore","Merlin"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 22, 'In "Jurassic Park," which dinosaur famously stalks the characters in the kitchen scene?', '["Tyrannosaurus Rex","Velociraptor","Triceratops","Pterodactyl"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 23, 'What is the name of Ash Ketchum''s iconic Electric-type Pokemon partner?', '["Charizard","Pikachu","Squirtle","Bulbasaur"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 24, 'Which DC superhero is also known as the "Dark Knight"?', '["Superman","Batman","The Flash","Green Lantern"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 25, 'What is the name of Bruce Wayne''s loyal butler in the Batman franchise?', '["Alfred","James","Charles","Edmund"]', 0, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 26, 'What activity is at the center of the "Fast & Furious" franchise?', '["Bank robbery","Street racing","Space travel","Boxing"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 27, 'Which British spy is known by the code number 007?', '["Jason Bourne","James Bond","Ethan Hunt","Jack Ryan"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 28, 'In "Toy Story," what type of toy is Buzz Lightyear?', '["Cowboy doll","Space Ranger action figure","Robot","Dinosaur"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 29, 'What is the name of the title character in the "Shrek" franchise?', '["Fiona","Shrek","Donkey","Puss"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 30, 'In "Finding Nemo," what type of fish is Nemo?', '["Clownfish","Angelfish","Goldfish","Blue Tang"]', 0, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 31, 'Which Pixar film features a rat who dreams of becoming a chef in Paris?', '["Ratatouille","Cars","Up","Brave"]', 0, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 32, 'In "Star Wars," what is the name of Luke Skywalker''s desert home planet?', '["Naboo","Tatooine","Hoth","Endor"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 33, 'What is the name of the villainous organization led by Kylo Ren in the Star Wars sequel trilogy?', '["The Empire","The First Order","The Sith Order","The Resistance"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 34, 'What is Peter Parker''s superhero alias in the Marvel franchise?', '["Daredevil","Spider-Man","Iron Man","Ant-Man"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 35, 'What is the name of Tony Stark''s company in the Marvel Cinematic Universe?', '["Wayne Enterprises","Stark Industries","Oscorp","LexCorp"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 36, 'Who is the main character and protagonist of "The Hunger Games"?', '["Primrose Everdeen","Katniss Everdeen","Effie Trinket","Johanna Mason"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 37, 'In "The Hunger Games," what is the name of the nation where the story takes place?', '["Panem","Elysium","Oceania","Westeros"]', 0, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 38, 'In "Despicable Me," what are Gru''s small yellow henchmen called?', '["Gremlins","Minions","Oompa Loompas","Smurfs"]', 1, 15),
('2059476b-d501-47b9-b6ce-f08267efd2e5', 39, 'In Disney''s "Aladdin," who is the master of the magic lamp''s genie at the start of the story?', '["The Sultan","Aladdin","Jafar","Iago"]', 1, 15);

-- Pop Culture & Entertainment
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 20, 'Which social media platform, founded in 2011, is known for disappearing photo and video messages?', '["Instagram","Snapchat","TikTok","WhatsApp"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 21, 'Which actor played Jack Dawson in "Titanic" (1997)?', '["Brad Pitt","Leonardo DiCaprio","Matt Damon","Tom Cruise"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 22, 'Which actress played Katniss Everdeen in "The Hunger Games" films?', '["Emma Stone","Jennifer Lawrence","Kristen Stewart","Shailene Woodley"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 23, 'Which awards show, nicknamed "the Emmys," honors achievement in television?', '["Grammy Awards","Tony Awards","Emmy Awards","Golden Globe Awards"]', 2, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 24, 'Which streaming platform released the series "The Mandalorian"?', '["Netflix","Hulu","Disney+","Peacock"]', 2, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 25, 'Who directed the first "Harry Potter" film, "The Sorcerer''s Stone"?', '["Steven Spielberg","Chris Columbus","Peter Jackson","Tim Burton"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 26, 'Which actor is best known for playing Iron Man in the Marvel Cinematic Universe?', '["Chris Evans","Robert Downey Jr.","Chris Hemsworth","Mark Ruffalo"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 27, 'Which cooking competition show hosted by Gordon Ramsay pits chefs against each other in a high-pressure kitchen?', '["MasterChef","Hell''s Kitchen","Top Chef","Chopped"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 28, 'Which pop star''s real name is Robyn Rihanna Fenty?', '["Beyonce","Rihanna","Ciara","Alicia Keys"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 29, 'What is the name of the fictional Indiana town where "Stranger Things" is set?', '["Hawkins","Riverdale","Derry","Smallville"]', 0, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 30, 'Which long-running late-night sketch comedy show is known for its "Weekend Update" segment?', '["The Daily Show","Saturday Night Live","MADtv","Late Night"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 31, 'Which actress played Wonder Woman in the DC film franchise starting in 2017?', '["Margot Robbie","Gal Gadot","Scarlett Johansson","Brie Larson"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 32, 'Which streaming platform is home to the superhero series "The Boys"?', '["Netflix","Amazon Prime Video","Hulu","Apple TV+"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 33, 'Who played the title role in the 2023 film "Barbie"?', '["Margot Robbie","Emma Stone","Anne Hathaway","Amy Adams"]', 0, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 34, 'Which reality dating show features a rose ceremony to eliminate contestants each episode?', '["Love Island","The Bachelor","Married at First Sight","Are You the One"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 35, 'What is the name of the fictional African nation in Marvel''s "Black Panther"?', '["Zamunda","Wakanda","Genosha","Latveria"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 36, 'Which K-pop group is known for global hits like "Dynamite" and "Butter"?', '["BLACKPINK","BTS","EXO","Stray Kids"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 37, 'Which actor voices Woody in the "Toy Story" franchise?', '["Tim Allen","Tom Hanks","Billy Crystal","John Ratzenberger"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 38, 'In which French city is a world-famous annual film festival held?', '["Nice","Cannes","Paris","Lyon"]', 1, 15),
('3d9f98b7-11b5-40d9-ab56-8ed3d93754f8', 39, 'Which actor starred in Jordan Peele''s directorial debut, "Get Out" (2017)?', '["Chadwick Boseman","Daniel Kaluuya","John Boyega","Michael B. Jordan"]', 1, 15);

-- Music & Audio Rounds
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('c0250e17-61cb-4320-9ac0-13b945244fbf', 20, 'Which legendary rock band recorded "Stairway to Heaven"?', '["The Rolling Stones","Led Zeppelin","Pink Floyd","The Who"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 21, 'Which artist released the iconic 1984 album "Purple Rain"?', '["Michael Jackson","Prince","David Bowie","George Michael"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 22, 'Which annual awards show, presented by the Recording Academy, honors achievement in the music industry?', '["Billboard Music Awards","Grammy Awards","American Music Awards","MTV Video Music Awards"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 23, 'Which British band, formed in Liverpool, included John Lennon and Paul McCartney?', '["The Rolling Stones","The Beatles","The Who","Queen"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 24, 'Which country music legend sang "Jolene"?', '["Reba McEntire","Dolly Parton","Loretta Lynn","Shania Twain"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 25, 'The violin belongs to which family of instruments?', '["Brass","Woodwind","Strings","Percussion"]', 2, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 26, 'Which girl group sang "Wannabe" and popularized the phrase "Girl Power"?', '["Destiny''s Child","Spice Girls","TLC","En Vogue"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 27, 'Which reggaeton artist popularized the global hit "Despacito"?', '["Daddy Yankee","Luis Fonsi","J Balvin","Bad Bunny"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 28, 'Which composer, who continued composing after losing his hearing, wrote the famous "9th Symphony"?', '["Mozart","Beethoven","Bach","Chopin"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 29, 'Which music genre is most associated with artists like Willie Nelson and Johnny Cash?', '["Blues","Jazz","Country","Folk"]', 2, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 30, 'The albums "Slim Shady" and "The Marshall Mathers LP" belong to which rapper, whose real name is Marshall Mathers?', '["50 Cent","Eminem","Jay-Z","Snoop Dogg"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 31, 'Which iconic music festival took place on a farm in upstate New York in 1969?', '["Coachella","Woodstock","Lollapalooza","Bonnaroo"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 32, 'Which pop star is known for the hit song "Genie in a Bottle"?', '["Britney Spears","Christina Aguilera","Jessica Simpson","Mandy Moore"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 33, 'Which iconic rock band''s lead singer was Freddie Mercury?', '["The Eagles","Queen","Aerosmith","Journey"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 34, 'Which country artist is known for the hit song "Before He Cheats"?', '["Miranda Lambert","Carrie Underwood","Kelsea Ballerini","Kacey Musgraves"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 35, 'What term describes a group of singers performing together without any instruments?', '["Chorus","A cappella","Ensemble","Harmony"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 36, 'Which musician fronted the grunge band Nirvana as lead singer and guitarist?', '["Eddie Vedder","Kurt Cobain","Chris Cornell","Layne Staley"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 37, 'Which Beatles album features the famous cover of the band crossing a London street?', '["Let It Be","Abbey Road","Revolver","The White Album"]', 1, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 38, 'Which instrument is typically the largest in a standard orchestra''s string section?', '["Violin","Viola","Cello","Double bass"]', 3, 15),
('c0250e17-61cb-4320-9ac0-13b945244fbf', 39, 'Which music streaming service popularized the term "curated playlist" in the 2010s?', '["Pandora","Spotify","SoundCloud","Tidal"]', 1, 15);

-- Geography & History
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 20, 'What is the capital of Italy?', '["Milan","Rome","Venice","Naples"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 21, 'Which is the largest hot desert in the world?', '["Gobi","Sahara","Kalahari","Arabian"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 22, 'Which mountain range is home to Mount Everest?', '["Andes","Rockies","Himalayas","Alps"]', 2, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 23, 'What is the capital of Russia?', '["St. Petersburg","Moscow","Kiev","Minsk"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 24, 'Which ancient civilization built the mountaintop city of Machu Picchu?', '["The Maya","The Aztec","The Inca","The Olmec"]', 2, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 25, 'In which country would you find the ancient rock-carved city of Petra?', '["Egypt","Jordan","Iran","Morocco"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 26, 'Which war was fought between the Northern and Southern United States from 1861 to 1865?', '["The Revolutionary War","The American Civil War","World War I","The War of 1812"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 27, 'What is the capital of Egypt?', '["Alexandria","Cairo","Giza","Luxor"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 28, 'Which European country is famously shaped like a boot?', '["Spain","Italy","Greece","Portugal"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 29, 'Which ancient wonder of the world, a giant lighthouse, once stood in Alexandria, Egypt?', '["Colossus of Rhodes","Lighthouse of Alexandria","Hanging Gardens","Temple of Artemis"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 30, 'In what year did the Berlin Wall officially fall?', '["1985","1987","1989","1991"]', 2, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 31, 'Which country straddles both Europe and Asia, with land on two continents?', '["France","Turkey","Poland","Norway"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 32, 'What is the name of the longest mountain range in the world, running through South America?', '["The Rockies","The Andes","The Alps","The Urals"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 33, 'Which empire was ruled by Julius Caesar?', '["The Greek Empire","The Roman Empire","The Ottoman Empire","The Persian Empire"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 34, 'What is the smallest continent by land area?', '["Europe","Antarctica","Australia","South America"]', 2, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 35, 'As of the 2020s, which country has the largest population in the world?', '["China","India","United States","Indonesia"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 36, 'In which Massachusetts town were the first shots of the American Revolutionary War fired?', '["Boston","Concord","Lexington","Salem"]', 2, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 37, 'What is the capital of Germany?', '["Munich","Frankfurt","Berlin","Hamburg"]', 2, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 38, 'Which explorer''s expedition was the first to circumnavigate the globe?', '["Christopher Columbus","Ferdinand Magellan","Vasco da Gama","Marco Polo"]', 1, 15),
('be63a08a-2bd3-4ee3-8cf4-b61e217d03e8', 39, 'Which ancient Greek city-state is considered the birthplace of democracy?', '["Sparta","Athens","Corinth","Thebes"]', 1, 15);

-- Food & Drink
insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds) values
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 20, 'Which spirit forms the base of a classic Old Fashioned cocktail?', '["Vodka","Whiskey","Gin","Rum"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 21, 'What is the main ingredient in traditional Greek tzatziki sauce?', '["Sour cream","Yogurt","Mayonnaise","Cream cheese"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 22, 'Which country is the origin of the rice and seafood dish paella?', '["Portugal","Spain","Mexico","Italy"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 23, 'What type of pastry is used to make a traditional French mille-feuille?', '["Shortcrust pastry","Filo pastry","Puff pastry","Choux pastry"]', 2, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 24, 'Which fruit is fermented to make traditional balsamic vinegar?', '["Apples","Grapes","Plums","Pears"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 25, 'What is the main grain used to brew traditional Japanese sake?', '["Wheat","Barley","Rice","Corn"]', 2, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 26, 'Which country is generally credited with popularizing the hamburger as we know it today?', '["Germany","United States","France","England"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 27, 'Which herb is the primary ingredient in traditional Italian pesto?', '["Oregano","Basil","Parsley","Thyme"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 28, 'Which spirit is distilled from sugarcane or molasses?', '["Whiskey","Rum","Gin","Brandy"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 29, 'Besides onions, what forms the base of traditional French onion soup broth?', '["Chicken stock","Vegetable stock","Beef stock","Fish stock"]', 2, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 30, 'Which country is the origin of the spicy fermented dish kimchi?', '["Japan","China","South Korea","Thailand"]', 2, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 31, 'What is the main ingredient used to make traditional tofu?', '["Rice","Soybeans","Chickpeas","Lentils"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 32, 'Which cocktail combines vodka and coffee liqueur, often served with a shot of espresso?', '["White Russian","Espresso Martini","Irish Coffee","Black Russian"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 33, 'What is the primary ingredient in traditional Indian naan bread?', '["Rice flour","Wheat flour","Corn flour","Chickpea flour"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 34, 'Which country is famous for originating the melted-cheese dish known as fondue?', '["France","Switzerland","Italy","Austria"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 35, 'What is the main alcohol used in a traditional Pina Colada?', '["Vodka","Tequila","Rum","Gin"]', 2, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 36, 'Which vegetable is the main ingredient in traditional coleslaw?', '["Lettuce","Cabbage","Spinach","Kale"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 37, 'What type of pepper gives traditional Tabasco sauce its heat?', '["Jalapeno pepper","Habanero pepper","Tabasco pepper","Ghost pepper"]', 2, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 38, 'Which country''s Vienna bakeries are credited with originating the crescent-shaped pastry that inspired the French croissant?', '["Germany","Austria","Switzerland","Belgium"]', 1, 15),
('a1038c84-3fb7-4738-bfa1-0351eb1ac449', 39, 'What is the main ingredient in traditional cold Spanish soup gazpacho?', '["Cucumbers","Tomatoes","Peppers","Onions"]', 1, 15);
