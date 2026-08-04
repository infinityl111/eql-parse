# EQL Parse &lt;SPAIN&gt; Guild

[Español](README.md) · **English**

[![Download](https://img.shields.io/github/v/release/infinityl111/eql-parse-spain?label=Download&style=for-the-badge&color=1f7c8c)](https://github.com/infinityl111/eql-parse-spain/releases/latest)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/eqcampeon)

Real-time combat parser for EverQuest Legends: damage meter, in-game overlay,
stance advice, voice alerts, and a post-fight breakdown of what could have gone
better.

Interface in Spanish, English, French, German and Portuguese.

![Main window](docs/combate.png)

---

## If you just want to use it

1. Download `EQL-Parse-SPAIN-1.0.0-setup.exe` and run it.
2. Windows will say it doesn't recognise the app. That's normal for unsigned
   programs: **More info → Run anyway**.
3. In game, type `/log on`.
4. Options → Filters: set **everything damage-related to full detail**, yours
   and other people's. Without this the parser never sees your group's damage
   and the numbers come out wrong. It's the number one mistake.
5. Open the app. It finds your `eqlog_*.txt` on every drive by itself.
6. In the advice panel, pick your three classes. They're also read by typing
   `/who` in game.
7. If you use a pet, type `/pet who leader` once: in EQL it gets a new name
   every summon, and this way it identifies itself.

### Shortcuts

| Shortcut | What it does |
| --- | --- |
| `Ctrl+Alt+M` | Show or hide the overlay |
| `Ctrl+Alt+O` | Toggle between clicks to the game and clicks to the overlay |
| `Ctrl+Alt+X` | Close the overlay |

The overlay needs EQL in **windowed or borderless**. Windows won't draw over
exclusive fullscreen.

---

## What it does

### Stance advice that's measured, not guessed

![Stance advice](docs/postura.png)

The log stores damage **already mitigated**: if you were in Defensive, the melee
you see is halved. Comparing stances against those numbers would always push you
toward whichever one you already had on. The program reverses the mitigation
using the stance active at each hit and compares raw damage instead.

Two thresholds fall out of the wiki's arithmetic that you can't eyeball:

- Channeler beats Defensive once magic damage exceeds half the melee.
- And it beats Mage Hunter once melee exceeds half the magic.

So Channeler isn't a timid middle ground: it's the correct pick across the whole
central band.

### Post-fight analysis

![Analysis](docs/analisis.png)

It cuts the fight into phases by what happens, not by the clock: when the
incoming damage composition flips, when you stop hitting, when a spike lands, or
when the boss summons. Then it flags eleven concrete things, each with its
impact quantified: downtime, wrong stance per window, accuracy, enemy heals,
control taken, interrupts, resists, wasted healing, focus, deaths, and burst
versus sustain.

### Overlay

Dims out of combat, lights up when the fight starts. When a fight ends it
highlights the result for a few seconds. It warns you when your stance isn't the
best one, and only when the switch is worth it.

### Voice

Reads incoming chat with a checkbox per channel — tells, group, guild, raid —
and narrates combat: recommended stance change, your death, your pet's, adds
joining, a summary when the fight ends.

It also calls out enemy casts that change the fight, filtered by category:
heals, charm, mez, fear, root. Enemies only, never your group, and the same
category from the same mob won't repeat within 8 seconds.

---

## If you want to work on it

```
npm install
npm start          # development
npm run dist       # installer in dist/
npm test           # engine test
npm run calibrate -- "path\to\eqlog.txt" --self YourChar
```

```
src/tailer.js      incremental log reading
src/patterns.js    pattern dictionary, calibrated against real logs
src/parser.js      line -> normalised event
src/encounter.js   fight segmentation and aggregation
src/stances.js     stance and invocation data for all 16 classes
src/advisor.js     which stance suits, on damage reversed to raw
src/analysis.js    post-fight analysis of long fights
src/spells.js      spell classification by category
src/narrator.js    voice: chat and combat
src/triggers.js    regex triggers, GINA style
src/i18n.js        translations
src/engine.js      the facade that ties it together
electron/          windows, IPC, configuration
ui/                interface, no build step
```

`npm run calibrate` walks a log and lists the lines the parser does **not**
recognise, ordered by frequency. It's the tool for extending the dictionary when
EQL changes wording or adds spells.

---

## What it cannot know

The EverQuest log records nobody's health, endurance, mana or position. That's
where the program's limits come from, and none of them are papered over:

- Each stance's cost tells you the price, **not whether you can pay it**.
- The analysis will never say a heal came late: there's no health data.
- Only **your** stance is known; nobody else's appears in the log.
- Timestamps have one-second resolution, so on short fights DPS carries a large
  structural error. It uses the GamParse/ACT convention,
  `total / (last − first + 1)`, which is what other people quote.
- Shield damage without a possessive (`shards of ice`) can't be attributed, so
  it's kept separate rather than pinned on someone.

---

## Support

Personal project, free to use. If you find it useful and feel like buying a
coffee, [here's the link](https://paypal.me/eqcampeon). No obligation.
