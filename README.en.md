# EQL Parse &lt;SPAIN&gt; Guild

[Español](README.md) · **English**

[![Download](https://img.shields.io/github/v/release/infinityl111/eql-parse-spain?label=Download&style=for-the-badge&color=1f7c8c)](https://github.com/infinityl111/eql-parse-spain/releases/latest)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/eqcampeon)

Real-time combat parser for EverQuest Legends. It measures your damage, tells
you which stance suits what is hitting you, reads chat aloud, keeps every fight
you've had, and builds a dossier on each enemy from what you've measured
yourself and what the wiki says.

Interface in Spanish, English, French, German and Portuguese.

![Main window](docs/combate.png)

---

## If you just want to use it

1. Download the installer and run it.
2. Windows will say it doesn't recognise the app. That's normal for unsigned
   programs: **More info → Run anyway**.
3. In game, type `/log on`.
4. Options → Filters: set **everything damage-related to full detail**, yours
   and other people's. Without this the parser never sees your group's damage
   and the numbers come out wrong. It's the number one mistake.
5. Open the app. It finds your `eqlog_*.txt` on every drive and reads the whole
   log the first time.
6. Pick your three classes, or type `/who` and they're read for you.
7. If you use a pet, type `/pet who leader` once: in EQL it gets a new name
   every summon, and this way it stays identified for good.

### Shortcuts

| Shortcut | What it does |
| --- | --- |
| `Ctrl+Alt+M` | Show or hide the overlay |
| `Ctrl+Alt+O` | Toggle between clicks to the game and clicks to the overlay |
| `Ctrl+Alt+X` | Close the overlay |

The overlay needs EQL in **windowed or borderless**. And if the game stutters
while you use it, check **Options → Display → Max Background FPS**: on «Min CPU»
the game drops to a few frames whenever it loses focus.

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

### Enemy dossier

![Enemy dossier](docs/enemigo.png)

Pick an enemy and see everything known about it:

- **Estimated health**, derived from the damage it took to drop it. The log
  gives no health values, so it's a measured bound and it says so.
- **Which of your spells it resists**, split by invocation. The same spell can
  land 20% of the time under Inversion and 80% under Over Channel; the mean of
  the two describes neither. You'll know from your own numbers whether the
  −150 resist adjust is worth it against each mob.
- **How it hits you**: its abilities by damage, and its biggest hit.
- **What the wiki says**, pulled from eqlwiki.com. On Lord Nagafen: "Fire and
  Magic Resists mean everything with this fellow".
- **What it drops**, with a link to each item.

### Range summary

![Range summary](docs/resumen.png)

Every fight from the last 2 h, 12 h, 24 h, 3 days, week or month in one
breakdown. Each combatant expands with abilities summed, by damage type, by
target, and who hit them. Dps is measured over seconds in combat, not over
elapsed time.

Fights are saved to disk, so they're there the moment you open the app without
re-reading the log.

### Post-fight analysis

![Analysis](docs/analisis.png)

It cuts the fight into phases by what happens, not by the clock: when the
incoming damage composition flips, when you stop hitting, when a spike lands, or
when the boss summons. Then it flags eleven concrete things, each with its
impact quantified: downtime, wrong stance per window, accuracy, enemy heals,
control taken, interrupts, resists, wasted healing, focus, deaths, and burst
versus sustain.

### Overlay

![Overlay](docs/overlay.png)

Two columns, your side and the enemies. Damage accumulates across the whole
session and only resets when you want it to. Rows expand on click, dead enemies
sink to the bottom, and when one drops a card shows for a few seconds who dealt
how much to it.

### Loot with item tooltips

![Item tooltip](docs/objeto.png)

Every fight records what dropped, telling apart what you picked up, what
auto-sold and what became an upgrade. Hovering shows the stat block in the
game's own style, pulled from the wiki; clicking opens its page.

### Voice and alerts

Reads incoming chat with a checkbox per channel and narrates combat:
recommended stance change, your death, your pet's, adds joining, a summary when
the fight ends. It also calls out enemy casts that change the fight — heals,
charm, mez, fear, root — enemies only and without repeating itself.

Plus a regex trigger editor, GINA style, with timers and live testing.

---

## If you want to work on it

```
npm install
npm start              # development
npm run dist           # installer in dist/
npm test               # 256 engine checks
npm run calibrate -- "path\to\eqlog.txt" --self YourChar
npm run store:check    # inspects the history without writing anything
npm run store:rebuild  # rebuilds it by re-reading the log
```

```
src/tailer.js      incremental log reading
src/patterns.js    pattern dictionary, calibrated against real logs
src/parser.js      line -> normalised event
src/encounter.js   fight segmentation and aggregation
src/store.js       fight store: append-only, never rewritten
src/rebuild.js     history rebuild by re-reading the log
src/aggregate.js   summing many fights, and the enemy dossier
src/stances.js     stance and invocation data for all 16 classes
src/advisor.js     which stance suits, on damage reversed to raw
src/analysis.js    post-fight analysis of long fights
src/wiki.js        item tooltips and tactical notes from eqlwiki.com
src/spells.js      spell classification by category
src/narrator.js    voice: chat and combat
src/triggers.js    regex triggers
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
- An enemy's health is an estimate from the damage it took to kill it, not an
  official figure.
- Timestamps have one-second resolution, so on short fights DPS carries a large
  structural error. It uses the GamParse/ACT convention,
  `total / (last − first + 1)`.
- Shield damage without a possessive (`shards of ice`) can't be attributed, so
  it's kept separate rather than pinned on someone.
- While an evasion stance is active there's no way to know how much damage
  would come in without it: the log doesn't distinguish a stance evade from an
  ordinary parry, and what you see is only the 5% of attacks that got through.
  There the split is shown, but nothing is recommended.

---

## Support

Personal project, free to use. If you find it useful and feel like buying a
coffee, [here's the link](https://paypal.me/eqcampeon). No obligation.
