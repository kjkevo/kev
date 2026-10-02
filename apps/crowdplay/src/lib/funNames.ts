// 80 x 80 = 6,400 "Adjective Noun" names, each 20 characters or less.
const ADJECTIVES = [
  "Tipsy", "Sneaky", "Dizzy", "Loud", "Clever", "Sly", "Feisty", "Rowdy",
  "Lucky", "Salty", "Spicy", "Chill", "Wild", "Cheeky", "Bold", "Fancy",
  "Grumpy", "Jolly", "Mighty", "Silky", "Zesty", "Groovy", "Sassy", "Snappy",
  "Brave", "Breezy", "Bubbly", "Bouncy", "Cosmic", "Crafty", "Cranky", "Crispy",
  "Dapper", "Daring", "Dusty", "Fearless", "Fizzy", "Fluffy", "Frosty", "Funky",
  "Fuzzy", "Giddy", "Gentle", "Glossy", "Golden", "Goofy", "Hasty", "Hungry",
  "Icy", "Jazzy", "Jumpy", "Keen", "Lazy", "Lively", "Lofty", "Mellow",
  "Merry", "Misty", "Moody", "Nifty", "Nimble", "Noble", "Peppy", "Perky",
  "Plucky", "Quirky", "Rapid", "Rusty", "Shiny", "Sleepy", "Smooth", "Sparky",
  "Speedy", "Sunny", "Swift", "Thirsty", "Tiny", "Wacky", "Witty", "Zippy",
];

const NOUNS = [
  "Flamingo", "Narwhal", "Otter", "Falcon", "Panther", "Koala", "Walrus",
  "Penguin", "Raccoon", "Badger", "Peacock", "Yeti", "Gremlin", "Wizard",
  "Pirate", "Ninja", "Llama", "Platypus", "Meerkat", "Toucan", "Hedgehog", "Gecko",
  "Alpaca", "Beaver", "Bison", "Bobcat", "Buffalo", "Camel", "Cheetah", "Cobra",
  "Coyote", "Crab", "Dingo", "Dolphin", "Donkey", "Eagle", "Ferret", "Fox",
  "Gazelle", "Goose", "Gopher", "Gorilla", "Hippo", "Hornet", "Husky", "Iguana",
  "Jackal", "Jaguar", "Kangaroo", "Kiwi", "Lemur", "Lion", "Lobster", "Lynx",
  "Mammoth", "Moose", "Moth", "Mustang", "Octopus", "Ostrich", "Owl", "Panda",
  "Parrot", "Pelican", "Pigeon", "Puffin", "Python", "Rhino", "Robot", "Shark",
  "Sloth", "Squid", "Tiger", "Turtle", "Viking", "Vulture", "Wombat", "Zebra",
  "Goblin", "Unicorn",
];

export function randomFunName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}

/** A handful of different names to check against the ones already taken. */
export function funNameBatch(count = 12): string[] {
  const out = new Set<string>();
  while (out.size < count) out.add(randomFunName());
  return Array.from(out);
}
