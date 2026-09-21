const ADJECTIVES = [
  "Tipsy", "Sneaky", "Dizzy", "Loud", "Clever", "Sly", "Feisty", "Rowdy",
  "Lucky", "Salty", "Spicy", "Chill", "Wild", "Cheeky", "Bold", "Fancy",
  "Grumpy", "Jolly", "Mighty", "Silky", "Zesty", "Groovy", "Sassy", "Snappy",
];

const NOUNS = [
  "Flamingo", "Narwhal", "Otter", "Falcon", "Panther", "Koala", "Walrus",
  "Penguin", "Raccoon", "Badger", "Peacock", "Yeti", "Gremlin", "Wizard",
  "Pirate", "Ninja", "Llama", "Platypus", "Meerkat", "Toucan", "Hedgehog", "Gecko",
];

export function randomFunName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}
