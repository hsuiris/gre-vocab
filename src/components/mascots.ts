// Sprites are produced by scripts/prepMascots.py from the raw art in
// assets/mascots/raw. Edit the raw files and re-run the script; never hand-edit
// the sprites, they get overwritten.
export const ANIMALS = {
  cat: require('../../assets/mascots/cat.png'),
  rabbit: require('../../assets/mascots/rabbit.png'),
  penguin: require('../../assets/mascots/penguin.png'),
  chick: require('../../assets/mascots/chick.png'),
  shiba: require('../../assets/mascots/shiba.png'),
  hamster: require('../../assets/mascots/hamster.png'),
  pig: require('../../assets/mascots/pig.png'),
  elephant: require('../../assets/mascots/elephant.png'),
};

export type AnimalName = keyof typeof ANIMALS;

export const GIRL = {
  idle: require('../../assets/mascots/girl-idle.png'),
  happy: require('../../assets/mascots/girl-happy.png'),
  sad: require('../../assets/mascots/girl-sad.png'),
};
