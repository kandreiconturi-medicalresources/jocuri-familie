// Aspectul fiecărei lumi: teren Kenney, cer, straturi de fundal, nuanțe.
// tint = [culoare, alpha] aplicat peste straturile Kenney; hills = [culoare spate, culoare față].
export const THEMES = {
  meadow: { terrain: 'grass', brick: 'bricks_brown', sky: ['#4aa8f5', '#a9dcff', '#e9f8ff'], set: 'hills', tint: null,
    hills: ['#8fd36e', '#62c05a'], sun: 'day', ambient: null, dark: 0 },
  forest: { terrain: 'grass', brick: 'bricks_brown', sky: ['#173c63', '#357f8f', '#9edbb8'], set: 'trees', tint: ['#0b3a3a', 0.35],
    hills: ['#2f7d55', '#21603f'], sun: 'moon', ambient: 'leaf', dark: 0.1 },
  sunset: { terrain: 'purple', brick: 'bricks_brown', sky: ['#4a2f80', '#e0629a', '#ffc98e'], set: 'hills', tint: ['#a0307a', 0.45],
    hills: ['#c96a9c', '#9c4a78'], sun: 'sunset', ambient: null, dark: 0 },
  desert: { terrain: 'sand', brick: 'bricks_brown', sky: ['#ffb347', '#ffd98a', '#fff1c8'], set: 'desert', tint: null,
    hills: ['#f2c27a', '#e3a85a'], sun: 'day', ambient: null, dark: 0 },
  beach: { terrain: 'sand', brick: 'bricks_brown', sky: ['#2aa7e8', '#7fd8f0', '#d8f6ff'], set: 'desert', tint: ['#2ab0e0', 0.3],
    hills: ['#6fd0e8', '#3fb0d8'], sun: 'day', ambient: null, dark: 0 },
  cave: { terrain: 'stone', brick: 'bricks_grey', sky: ['#120a2a', '#2a1850', '#4a2c7a'], set: 'trees', tint: ['#2a1060', 0.6],
    hills: ['#3a2670', '#2a1858'], sun: 'crystal', ambient: 'glow', dark: 0.12 },
  snow: { terrain: 'snow', brick: 'bricks_grey', sky: ['#7fa8d8', '#c8e0f5', '#f4faff'], set: 'hills', tint: ['#ffffff', 0.55],
    hills: ['#e4f0fa', '#c6dcf0'], sun: 'day', ambient: 'snow', dark: 0 },
  mushroom: { terrain: 'dirt', brick: 'bricks_brown', sky: ['#6a3a9a', '#d878a8', '#ffcaa0'], set: 'mushrooms', tint: null,
    hills: ['#c0603a', '#a04a30'], sun: 'sunset', ambient: 'spore', dark: 0 },
  clouds: { terrain: 'cloud', brick: 'bricks_grey', sky: ['#5ab0ff', '#b4dcff', '#f4fbff'], set: 'clouds', tint: null,
    hills: ['#ffffff', '#dcecff'], sun: 'day', ambient: null, dark: 0 },
  volcano: { terrain: 'stone', brick: 'bricks_grey', sky: ['#1a0505', '#6a1a10', '#d8541a'], set: 'desert', tint: ['#802010', 0.6],
    hills: ['#4a1a10', '#32100a'], sun: 'lava', ambient: 'ember', dark: 0.3 },
};
export const themeFor = (key) => THEMES[key] || THEMES.meadow;

export const WORLD_ICON = ['🌳', '🌲', '🌅', '🏜️', '🐚', '💎', '⛄', '🍄', '☁️', '🌋'];
