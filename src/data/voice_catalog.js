// Canonical 68-clip neural voiceover catalog for Playtime Prank RPG 3D: Lily, Giblet & The Smiling Critters!
// Synthesized via edge-tts (en-US-GuyNeural, en-US-ChristopherNeural, en-US-AnaNeural) into assets/voice/*.mp3.

export const VOICE_SPEAKERS = Object.freeze({
  narrator: Object.freeze({
    id: 'narrator',
    name: 'Playtime Prank Announcer',
    voice: 'en-US-AnaNeural',
    rate: '+6%',
    pitch: '+6Hz',
  }),
  cappuccina: Object.freeze({
    id: 'cappuccina',
    name: 'Lily Lovebraids',
    voice: 'en-US-AnaNeural',
    rate: '+8%',
    pitch: '+12Hz',
  }),
  bananini: Object.freeze({
    id: 'bananini',
    name: 'Giblet Tea Buddy',
    voice: 'en-US-AnaNeural',
    rate: '+12%',
    pitch: '+16Hz',
  }),
  lirili: Object.freeze({
    id: 'lirili',
    name: 'Hoppy and KickinChicken',
    voice: 'en-US-AnaNeural',
    rate: '+5%',
    pitch: '+8Hz',
  }),
  sahur: Object.freeze({
    id: 'sahur',
    name: 'Chum Chompkins',
    voice: 'en-US-GuyNeural',
    rate: '+8%',
    pitch: '+4Hz',
  }),
  tralalero: Object.freeze({
    id: 'tralalero',
    name: 'Tea Pod Gracie',
    voice: 'en-US-GuyNeural',
    rate: '+6%',
    pitch: '-6Hz',
  }),
  bombardiro: Object.freeze({
    id: 'bombardiro',
    name: 'Hungry CatNap',
    voice: 'en-US-ChristopherNeural',
    rate: '+4%',
    pitch: '-10Hz',
  }),
  patapim: Object.freeze({
    id: 'patapim',
    name: 'Tiny-Legs Prototype',
    voice: 'en-US-ChristopherNeural',
    rate: '+2%',
    pitch: '-14Hz',
  }),
  sahur_king: Object.freeze({
    id: 'sahur_king',
    name: 'Clown Mech Boss',
    voice: 'en-US-GuyNeural',
    rate: '+2%',
    pitch: '-16Hz',
  }),
});

export const VOICE_CATALOG = Object.freeze([
  // 1. Onboarding, Rhythm Combo & Kid Coaching (10)
  Object.freeze({
    id: 'guide_title',
    speaker: 'narrator',
    text: 'Welcome to Playtime Prank RPG 3D with Lily Lovebraids, Giblet, and Chum Chompkins! Tap Play!',
  }),
  Object.freeze({
    id: 'guide_welcome',
    speaker: 'sahur',
    text: 'Chum Chompkins here! Tap the glowing Tea Party Gift Box right in front of us!',
  }),
  Object.freeze({
    id: 'guide_starter_pop',
    speaker: 'narrator',
    text: 'Awesome! Golden Crumpet Stars, a Prank Pod Kit, and a Free Gadget Spin!',
  }),
  Object.freeze({
    id: 'guide_tap_block',
    speaker: 'narrator',
    text: 'Tap any glowing Prank Box to bonk it three times with your GrabPack Hand!',
  }),
  Object.freeze({
    id: 'guide_combo_sahur',
    speaker: 'sahur',
    text: 'Boing, slap, splash! Super Stretchy Braid and Crumpet shockwave combo!',
  }),
  Object.freeze({
    id: 'guide_boing_hint',
    speaker: 'narrator',
    text: 'Boing! Stretchy pigtail bounce! Spin the wheel for a stronger prank gadget first!',
  }),
  Object.freeze({
    id: 'guide_ready_tralalero',
    speaker: 'narrator',
    text: 'GrabPack Hand ready! Let us prank Tea Pod Gracie in the Pink Capsule Lab!',
  }),
  Object.freeze({
    id: 'guide_ready_bombardiro',
    speaker: 'narrator',
    text: 'Purple Braid Whip ready! Let us share crumpets with Hungry CatNap by the Fridge!',
  }),
  Object.freeze({
    id: 'guide_ready_patapim',
    speaker: 'narrator',
    text: 'Spring Boots on! Let us unscrew Tiny-Legs Prototype on the Critters Soccer Court!',
  }),
  Object.freeze({
    id: 'guide_ready_king',
    speaker: 'narrator',
    text: 'Makeup Blaster ready! Give the Clown Mech Boss a rainbow makeover in the Workshop!',
  }),

  // 2. 5 Prank Gadgets (5)
  Object.freeze({
    id: 'vo_wpn_bat',
    speaker: 'sahur',
    text: 'Blue and Red GrabPack Hand! Stretchy high-five power for popping prank crates!',
  }),
  Object.freeze({
    id: 'vo_wpn_gong',
    speaker: 'cappuccina',
    text: 'Swish boing! My Purple Braid Whip blocks soccer balls and tickles bosses!',
  }),
  Object.freeze({
    id: 'vo_wpn_mallet',
    speaker: 'bananini',
    text: 'Ding ding! Breezy-Bake Crumpet Teapot Launcher! Fresh golden crumpets for everyone!',
  }),
  Object.freeze({
    id: 'vo_wpn_taiko',
    speaker: 'lirili',
    text: 'Puff sparkle! KickinChicken Rainbow Makeup Blaster! Instant silly clown makeover!',
  }),
  Object.freeze({
    id: 'vo_wpn_rainbow',
    speaker: 'sahur',
    text: 'Ultimate Jackpot! The Prank Remote and Magnet Wrench of Champions!',
  }),

  // 3. Hub Prank Stations & Smiling Critter Helpers (9)
  Object.freeze({
    id: 'vo_totem_tier1',
    speaker: 'bananini',
    text: 'Hooray! The Pink Capsule Tea Pod is open and popping silly Tea-Party Hats!',
  }),
  Object.freeze({
    id: 'vo_totem_tier2',
    speaker: 'cappuccina',
    text: 'Yum! My Dollhouse Breezy-Bake Crumpet Oven and Stocked Fridge are baking golden stars!',
  }),
  Object.freeze({
    id: 'vo_totem_tier3',
    speaker: 'cappuccina',
    text: 'Whoa! The GrabPack Prank Turret is launching rainbow makeup and stretchy braids!',
  }),
  Object.freeze({
    id: 'helper_cappuccina_wake',
    speaker: 'bananini',
    text: 'Giblet here! Pink Capsule Tea Pod ready with fancy bowties and teacup hats!',
  }),
  Object.freeze({
    id: 'helper_bananini_wake',
    speaker: 'cappuccina',
    text: 'Lily Lovebraids reporting! Welcome to my Dollhouse Tea Party and Crumpet Kitchen!',
  }),
  Object.freeze({
    id: 'helper_lirili_wake',
    speaker: 'sahur',
    text: 'Chum Chompkins belly laugh! Extra crumpets, cookies, and silly belly bounces!',
  }),
  Object.freeze({
    id: 'helper_assassino_wake',
    speaker: 'lirili',
    text: 'Hoppy, KickinChicken, and Baba Chops here! Our GrabPack Prank Turret is online!',
  }),
  Object.freeze({
    id: 'fairy_pot_max',
    speaker: 'cappuccina',
    text: 'All four Tea Party Prank Stations are maxed out! Golden Crumpet Star fountain!',
  }),
  Object.freeze({
    id: 'fairy_need_stars',
    speaker: 'narrator',
    text: 'Collect more Crumpet Stars or win the earlier Prank Boss Trophy first!',
  }),

  // 4. Prank Gadget Roulette Wheel (3)
  Object.freeze({
    id: 'wheel_open',
    speaker: 'cappuccina',
    text: 'Spin the Prank Gadget Wheel for a stretchy braid, teapot, or makeup blaster!',
  }),
  Object.freeze({
    id: 'wheel_spinning',
    speaker: 'sahur',
    text: 'Round and round the Tea Party Prank Wheel goes! What gadget will we get?',
  }),
  Object.freeze({
    id: 'wheel_jackpot',
    speaker: 'cappuccina',
    text: 'Tea Party Jackpot! Bonus Crumpet Stars and a glowing ribbon shield heart!',
  }),

  // 5. 12 Wacky Mystery Crate Drops & Gear (13)
  Object.freeze({
    id: 'vo_drop_stars',
    speaker: 'narrator',
    text: 'Shiny Golden Crumpet Stars!',
  }),
  Object.freeze({
    id: 'vo_drop_jackpot',
    speaker: 'sahur',
    text: 'Whoa! Stocked Dollhouse Fridge Crumpet Star Shower!',
  }),
  Object.freeze({
    id: 'vo_drop_seed',
    speaker: 'cappuccina',
    text: 'A Prank Pod Kit! Tap Prank to build a Tea Pod, Crumpet Oven, or Turret!',
  }),
  Object.freeze({
    id: 'vo_drop_wheel',
    speaker: 'cappuccina',
    text: 'Free Spin Token! Let us spin the Prank Gadget Wheel!',
  }),
  Object.freeze({
    id: 'vo_drop_mango',
    speaker: 'narrator',
    text: 'Yum! Warm Breezy-Bake Golden Crumpets and Strawberry Tea!',
  }),
  Object.freeze({
    id: 'vo_drop_latte',
    speaker: 'cappuccina',
    text: 'Sweet Berry Tea Zoom! Super fast feet and a bonus ribbon heart!',
  }),
  Object.freeze({
    id: 'vo_drop_bananini',
    speaker: 'sahur',
    text: 'Hehe! Mini Chum Chompkins popped out giggling!',
  }),
  Object.freeze({
    id: 'vo_drop_confetti',
    speaker: 'bananini',
    text: 'Hooray! Rainbow Ribbon Confetti and Mini Giblet Tea Buddy!',
  }),
  Object.freeze({
    id: 'vo_drop_toot',
    speaker: 'lirili',
    text: 'Boing whoop! Silly Whoopee Cushion and Mini Hoppy Hopscotch!',
  }),
  Object.freeze({
    id: 'vo_gear_boots',
    speaker: 'lirili',
    text: 'Hoppy Bouncy Spring Boots! Zoom and jump across the Dollhouse!',
  }),
  Object.freeze({
    id: 'vo_gear_crown',
    speaker: 'cappuccina',
    text: 'Fancy Pink Capsule Tea-Party Hat! Five glowing ribbon shield hearts!',
  }),
  Object.freeze({
    id: 'vo_gear_cape',
    speaker: 'cappuccina',
    text: 'Lily Lovebraids Ribbon Cape! Super Crumpet Star magnet!',
  }),
  Object.freeze({
    id: 'vo_boss_alert',
    speaker: 'sahur',
    text: 'Ooh! Tea party prank alert! A Giant Playtime Boss just walked in!',
  }),

  // 6. 3 Pattable Mini Helpers (3)
  Object.freeze({
    id: 'vo_pet_cappuccina',
    speaker: 'bananini',
    text: 'Hehe! Mini Giblet loves high-fives and shares extra Crumpet Stars!',
  }),
  Object.freeze({
    id: 'vo_pet_bananini',
    speaker: 'sahur',
    text: 'Yum yum! Happy Mini Chum Chompkins shares golden snacks with you!',
  }),
  Object.freeze({
    id: 'vo_pet_lirili',
    speaker: 'lirili',
    text: 'Boing boing! Mini Hoppy Hopscotch cheers for our soccer goal!',
  }),

  // 7. 4 Giant Prank Target Bosses (20)
  Object.freeze({
    id: 'boss_tralalero_spawn',
    speaker: 'tralalero',
    text: 'Step into my Pink Capsule Pod! Every proper guest needs a fancy makeover!',
  }),
  Object.freeze({
    id: 'boss_tralalero_boing',
    speaker: 'tralalero',
    text: 'Teacup bounce! Spin the wheel for a GrabPack Hand before our tea party!',
  }),
  Object.freeze({
    id: 'boss_tralalero_ouch',
    speaker: 'tralalero',
    text: 'Oh my ribbons! That Pink Capsule Pod just put a giant teacup hat on my head!',
  }),
  Object.freeze({
    id: 'boss_tralalero_defeat',
    speaker: 'tralalero',
    text: 'Hehe, this silly Tea-Party Hat and bowtie actually look fabulous! Take my Trophy!',
  }),
  Object.freeze({
    id: 'vo_win_tralalero',
    speaker: 'narrator',
    text: 'Hooray! Tea Pod Gracie is wearing her silly teacup hat! Trophy one!',
  }),

  Object.freeze({
    id: 'boss_bombardiro_spawn',
    speaker: 'bombardiro',
    text: 'Meow rumble! My tummy is grumbling by the Dollhouse Fridge! Where are the snacks?',
  }),
  Object.freeze({
    id: 'boss_bombardiro_boing',
    speaker: 'bombardiro',
    text: 'Purr bounce! Bring Lily Purple Braid Whip or a warm crumpet first!',
  }),
  Object.freeze({
    id: 'boss_bombardiro_ouch',
    speaker: 'bombardiro',
    text: 'Ooh! Fresh Breezy-Bake golden crumpets and butter! Those smell delicious!',
  }),
  Object.freeze({
    id: 'boss_bombardiro_defeat',
    speaker: 'bombardiro',
    text: 'Purr! My tummy is full of warm golden crumpets! Let us be best friends! Take my Trophy!',
  }),
  Object.freeze({
    id: 'vo_win_bombardiro',
    speaker: 'narrator',
    text: 'Awesome job! Hungry CatNap loves our Breezy-Bake crumpets! Two trophies won!',
  }),

  Object.freeze({
    id: 'boss_patapim_spawn',
    speaker: 'patapim',
    text: 'Clank stomp! Nobody can score past Lily stretchy braids or my giant spider legs!',
  }),
  Object.freeze({
    id: 'boss_patapim_boing',
    speaker: 'patapim',
    text: 'Clang bounce! Put on Spring Boots and grab the Crumpet Teapot Launcher first!',
  }),
  Object.freeze({
    id: 'boss_patapim_ouch',
    speaker: 'patapim',
    text: 'Hey! Stop unscrewing my giant spider legs! Everyone will see my tiny little shoes!',
  }),
  Object.freeze({
    id: 'boss_patapim_defeat',
    speaker: 'patapim',
    text: 'Oh no, my giant legs popped off and my tiny goofy legs are out! Take my Trophy!',
  }),
  Object.freeze({
    id: 'vo_win_patapim',
    speaker: 'narrator',
    text: 'Haha! Look at Tiny-Legs Prototype dancing in his tiny shoes! Three trophies!',
  }),

  Object.freeze({
    id: 'boss_king_spawn',
    speaker: 'sahur_king',
    text: 'Beep boop! Behold my giant Stained-Glass Workshop Spider-Mech!',
  }),
  Object.freeze({
    id: 'boss_king_boing',
    speaker: 'sahur_king',
    text: 'Buzzer bounce! Bring KickinChicken Makeup Blaster or the Prank Remote to prank me!',
  }),
  Object.freeze({
    id: 'boss_king_ouch',
    speaker: 'sahur_king',
    text: 'Honk honk! Why am I wearing a rainbow afro wig, big red clown nose, and polka dots?',
  }),
  Object.freeze({
    id: 'boss_king_defeat',
    speaker: 'sahur_king',
    text: 'Honk giggle! Lily, Giblet, Chum, and the Smiling Critters win the Silly Prank Party!',
  }),
  Object.freeze({
    id: 'vo_win_king',
    speaker: 'narrator',
    text: 'We did it! All four Playtime Prank Trophies won! Crumpet tea party time!',
  }),

  // 8. Finale, Persistence & Modes (5)
  Object.freeze({
    id: 'vo_finale_parade',
    speaker: 'cappuccina',
    text: 'Grand Dollhouse Tea Party! Golden crumpets, stretchy braids, and giggles for everyone!',
  }),
  Object.freeze({
    id: 'vo_keep_playing',
    speaker: 'narrator',
    text: 'Welcome back to Lily Lovebraids and Giblet Tea Hub! Let us keep pranking!',
  }),
  Object.freeze({
    id: 'vo_chaos_on',
    speaker: 'sahur',
    text: 'Silly Prank Chaos Mode on! Every Gift Box pops double crumpet and makeup surprises!',
  }),
  Object.freeze({
    id: 'vo_chaos_off',
    speaker: 'narrator',
    text: 'Cozy Tea Party Mode! Sunny Dollhouse adventure!',
  }),
  Object.freeze({
    id: 'sahur_sleepy_zzz',
    speaker: 'narrator',
    text: 'Hold on! That Prank Boss is still getting dressed! Win the earlier trophy first!',
  }),
]);

export const VOICE_CLIP_LIST = VOICE_CATALOG;

export const VOICE_BY_ID = Object.freeze(
  Object.fromEntries(VOICE_CATALOG.map((clip) => [clip.id, clip]))
);
