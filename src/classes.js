/**
 * Qué clase demuestra cada hechizo.
 *
 * En EQL puedes cambiar de trío de clases y **el log no lo notifica en ningún
 * sitio**. Lo único que lo cuenta es el /who, y nadie lo escribe cada media
 * hora: medido en un log real de 27 horas, cinco /who en total, y entre el
 * cambio de trío y el /who que lo confirmó pasaron dos horas y cuarto — 32
 * peleas guardadas con el trío y el nivel equivocados.
 *
 * La señal continua es qué lanzas tú. Pero sólo prueba algo lo que sea
 * EXCLUSIVO de una clase: si dos clases tienen el mismo hechizo, lanzarlo no
 * dice cuál de las dos llevas. De 42 hechizos lanzados en ese log, 27 eran
 * exclusivos y cubrían el 84% de los lanzamientos — suficiente para reconstruir
 * la línea de tiempo entera.
 *
 * Y se comprobó que el método no se contradice: ordenando todos los
 * lanzamientos exclusivos de Druida y de Chamán salen exactamente dos
 * transiciones limpias y ni un solo solapamiento en 181 lanzamientos.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LISTAS CONSULTADAS EN EL WIKI DE EQL, páginas de clase. No son medidas.
 *
 * La exclusividad se calcula ENTRE LAS CLASES QUE HAY AQUÍ. Si añades una
 * clase nueva al juego o quieres cubrir otra, hay que traer su lista: un
 * hechizo que parezca exclusivo sólo porque falta la lista de quien también lo
 * tiene sería una prueba falsa. Por eso `proofOf` sólo responde de hechizos
 * que estén en alguna lista, y calla ante lo que no conoce.
 */

const LISTAS = {
  SHD: ['Lifetap', 'Spike of Disease', 'Sense the Dead', 'Invisibility versus Undead', 'Disease Cloud', 'Siphon Strength', 'Leering Corpse', 'Lifespike', 'Despair', 'Numb the Dead', 'Endure Cold', 'Clinging Darkness', 'Fear', 'Shadow Step', 'Bone Walk', 'Lifedraw', 'Scream of Hate', 'Vampiric Embrace', 'Grim Aura', 'Deadeye', 'Cancelling of Life', 'Ward Undead', 'Cure Disease', 'Tiny Companion', 'Engulfing Darkness', 'Spook the Dead', 'Dark Empathy', 'Convoke Shadow', 'Scream of Pain', 'Feign Death', 'Endure Disease', 'Wave of Enfeeblement', 'Heat Blood', 'Strengthen Death', 'Gather Shadows', 'Restless Bones', 'Siphon Life', 'Negation of Life', 'Shieldskin', 'Dark Temptation', 'Terror of Darkness', 'Spear of Disease', 'Resist Cold', 'Shroud of Hate', 'Cancel Magic', 'Heart Flutter', 'Spirit Tap', 'Scream of Death', 'Shadow Vortex', 'Animate Dead', 'Expulse Undead', 'Voice of Darkness', 'Shadow Sight', 'Blood of Pain', 'Terror of Shadows', 'Invoke Fear', 'Dooming Darkness', 'Breath of the Dead', 'Word of Spirit', 'Summon Dead', 'Voice of Shadows', 'Life Leech', 'Scythe of Darkness', 'Spear of Pain', 'Dismiss Undead', 'Drain Spirit', 'Harmshield', 'Shroud of Pain'],

  MAG: ['Burst of Flame', 'Fire Flux', 'Flare', 'Minor Shielding', 'Reclaim Energy', 'Summon Dagger', 'Summon Drink', 'Summon Food', 'True North', 'Elementalkin: Water', 'Summon Bandages', 'Summon Brass Choker', 'Elementalkin: Fire', 'Sense Summoned', 'Summon Wisp', 'Burn', 'Elementalkin: Air', 'Gate', 'Elementalkin: Earth', 'Flame Bolt', 'Lesser Shielding', 'Dimensional Pocket', 'Elementaling: Water', 'Eye of Zomm', 'Elementaling: Fire', 'Renew Elements', 'Shield of Fire', 'Shock of Blades', 'Elementaling: Air', 'Invisibility', 'Staff of Tracing', 'Summon Linen Mantle', 'Elementaling: Earth', 'Summon Fang', 'Ward Summoned', 'Elemental: Water', 'Rain of Blades', 'Summon Tarnished Bauble', 'Burnout', 'Elemental: Fire', 'Summon Elemental Defender', 'Bind Affinity', 'Column of Fire', 'Elemental: Air', 'Elemental: Earth', 'Phantom Leather', 'Minor Summoning: Water', 'Staff of Warding', 'Minor Summoning: Fire', 'Shock of Flame', 'Summon Heatstone', 'Summon Throwing Dagger', 'Minor Summoning: Air', 'See Invisible', 'Shielding', 'Summon Tiny Ring', 'Minor Summoning: Earth', 'Rain of Fire', 'Summon Phantom Leather', 'Summon Waterstone', 'Bolt of Flame', 'Expulse Summoned', 'Lesser Summoning: Water', 'Renew Summoning', 'Elemental Shield', 'Lesser Summoning: Fire', 'Shield of Flame', 'Lesser Summoning: Air', 'Spear of Warding', 'Summon Arrows', 'Summon Jade Bracelet', 'Summon Wooden Bracelet', 'Cornucopia', 'Lesser Summoning: Earth', 'Summon Silver Choker', 'Everfount', 'Flame Flux', 'Malaise', 'Summoning: Water', 'Shock of Spikes', 'Summoning: Fire', 'Major Shielding', 'Staff of Runes', 'Summoning: Air', 'Dismiss Summoned', 'Phantom Chain', 'Summon Phantom Chain', 'Summoning: Earth', 'Greater Summoning: Water', 'Rain of Spikes', 'Sword of Runes', 'Expedience', 'Greater Summoning: Fire', 'Summon Leather Mantle', 'Expel Summoned', 'Greater Summoning: Air', 'Inferno Shield', 'Burnout II', 'Greater Summoning: Earth', 'Summon Coldstone', 'Dimensional Hole', 'Monster Summoning I', 'Summon Shiny Bauble', 'Blaze', 'Minor Conjuration: Water', 'Summon Shard of the Core', 'Greater Shielding', 'Minor Conjuration: Fire', 'Nullify Magic', 'Cinder Bolt', 'Minor Conjuration: Air', 'Staff of Symbols', 'Minor Conjuration: Earth', 'Refresh Summoning', 'Dagger of Symbols', 'Rain of Lava', 'Lesser Conjuration: Water', 'Summon Companion', 'Lesser Conjuration: Fire', 'Summon Ring of Flight', 'Summon Twisted Ring', 'Barrier of Combustion', 'Lesser Conjuration: Air', 'Summon Phantom Plate', 'Flame Arc', 'Lesser Conjuration: Earth', 'Conjuration: Water', 'Elemental Armor', 'Phantom Plate', 'Shock of Swords', 'Bounce', 'Conjuration: Fire', 'Summon Opal Bracelet', 'Summon: Orb of Exploration', 'Arch Shielding', 'Conjuration: Air', 'Elemental Maelstrom', 'Conjuration: Earth', 'Malaisement', 'Modulating Rod', 'Primal Remedy', 'Summon Stone Bracelet', 'Shield of Lava', 'Summon Orb', 'Greater Conjuration: Earth', 'Ward of Calliav', 'Burnout III', 'Greater Conjuration: Fire', 'Lava Bolt', 'Banish Summoned', 'Greater Conjuration: Air', 'Summon Elemental Blanket', 'Greater Conjuration: Water', 'Rain of Swords', 'Monster Summoning II', 'Summon Golden Choker'],

  DRU: ['Burst of Flame', 'Dance of the Fireflies', 'Endure Fire', 'Flame Lick', 'Lull Animal', 'Minor Healing', 'Panic Animal', 'Sense Animals', 'Skin like Wood', 'Snare', 'Tangling Weeds', 'Grasping Roots', 'Ward Summoned', 'Burst of Fire', 'Whirling Wind', 'Budding Heal', 'Camouflage', 'Cure Disease', 'Invoke Lightning', 'Cure Poison', 'Gate', 'Harmony', 'Enduring Breath', 'Firefist', 'Treeform', 'Shield of Thistles', 'Strength of Earth', 'Thistlecoat', 'Ignite', 'Invisibility versus Animals', 'Remove Minor Curse', 'Endure Cold', 'Light Healing', 'Protection of Wood', 'Starshine', 'Spirit of Wolf', 'Sprouting Heal', 'Stinging Swarm', 'Summon Drink', 'Halo of Light', 'Summon Food', 'Bind Affinity', 'Cascade of Hail', 'Befriend Animal', 'Expulse Summoned', 'See Invisible', 'Levitate', 'Skin like Rock', 'Calm Animal', 'Ring of North Karana', 'Ring of Surefall Glade', 'Terrorize Animal', 'Careless Lightning', 'Dizzying Wind', 'Ring of Butcherblock', 'Barbcoat', 'Ring of Toxxulia', 'Ring of West Commons', 'Shield of Barbs', 'Tiny Companion', 'Cancel Magic', 'Feral Spirit', 'Lesser Succor', 'Superior Camouflage', 'Endure Disease', 'Endure Poison', 'Healing', 'Protection of Rock', 'Flowering Heal', 'Resist Fire', 'Ring of South Ro', 'Ring of Stonebrunt', 'Wolf Form', 'Ensnaring Roots', 'Ring of Steamfont', 'Spirit of Cheetah', 'Tremor', 'Pogonip', 'Ring of Feerrott', 'Ring of Lavastorm', 'Sunbeam', 'Charm Animals', 'Dismiss Summoned', 'Remove Lesser Curse', 'Creeping Crud', 'Skin like Steel', 'Circle of Butcherblock', 'Circle of North Karana', 'Circle of Toxxulia', 'Immolate', 'Ring of Misty Thicket', 'Circle of Surefall Glade', 'Ensnare', 'Scale of Wolf', 'Succor: East Karana', 'Bramblecoat', 'Circle of West Commons', 'Protection of Steel', 'Shield of Brambles', 'Beguile Plants', 'Circle of Stonebrunt', 'Combust', 'Counteract Disease', 'Counteract Poison', 'Greater Healing', 'Harmony of Nature', 'Imbue Emerald', 'Imbue Plains Pebble', 'Mass Imbue Emerald', 'Mass Imbue Plains Pebble', 'Blooming Heal', 'Circle of Lavastorm', 'Fury of Air', 'Greater Wolf Form', 'Resist Cold', 'Spirit of the Shrew', 'Circle of Steamfont', 'Earthquake', 'Lightning Strike', 'Circle of Feerrott', 'Circle of South Ro', 'Drones of Doom', 'Succor: Butcherblock', 'Zephyr: Toxxulia', 'Beguile Animals', 'Expel Summoned', 'Zephyr: Butcherblock', 'Endure Magic', 'Healing Water', 'Regeneration', 'Strength of Stone', 'Zephyr: North Karana', 'Pack Shrew', 'Pack Spirit', 'Share Wolf Form', 'Zephyr: Stonebrunt', 'Zephyr: Surefall Glade', 'Zephyr: West Commons', 'Circle of Misty Thicket', 'Enveloping Roots', 'Skin like Diamond', 'Avalanche', 'Shield of Spikes', 'Spikecoat', 'Firestrike', 'Remove Curse', 'Succor: South Ro', "Nature's Renewal", 'Pack Regeneration', 'Protection of Diamond', 'Zephyr: Feerrott', 'Zephyr: Steamfont', 'Blossoming Heal', 'Drifting Death', 'Form of the Great Wolf', 'Zephyr: South Ro', 'Savage Spirit', 'Succor: Lavastorm', 'Summon Companion', 'Chloroplast', 'Fixation of Ro', 'Allure of the Wild', 'Banish Summoned', 'Dustdevil', 'Nullify Magic', 'Resist Disease', 'Resist Poison', 'Storm Strength', 'Superior Healing', 'Engulfing Roots', 'Pack Chloroplast', 'Share Form of the Great Wolf', 'Zephyr: Misty Thicket', 'Lightning Blast', 'Skin like Nature', 'Succor: North Karana', 'Ice', 'Shield of Thorns', 'Thorncoat', 'Zephyr: Lavastorm', 'Efflorescing Heal', 'Fire', 'Improved Superior Camouflage', 'Starfire', 'Upheaval', "Forest's Renewal", 'Legacy of Spike', 'Protection of Nature', 'Resist Magic', 'Vengeance of the Wild', 'Everlasting Breath', 'Levitation'],

  SHM: ['Burst of Flame', 'Cure Disease', 'Dexterous Aura', 'Endure Cold', 'Flash of Light', 'Inner Fire', 'Minor Healing', 'Strengthen', 'True North', 'Cure Poison', 'Spirit Pouch', 'Summon Drink', 'Feet like Cat', 'Scale Skin', 'Fleeting Fury', 'Frost Rift', 'Sicken', 'Drowsy', 'Endure Fire', 'Gate', 'Serpent Sight', 'Spirit of Bear', 'Summon Food', 'Cure Blindness', 'Sense Animals', 'Spirit Sight', 'Endure Disease', 'Tainted Breath', 'Talisman of the Beast', 'Light Healing', 'Remove Minor Curse', 'Spirit of Wolf', 'Invisibility versus Animals', 'Levitate', 'Spirit of Snake', 'Burst of Strength', 'Endure Poison', 'Turtle Skin', 'Disempower', 'Enduring Breath', 'Root', 'Walking Sleep', 'Bind Affinity', 'Snails Healing', 'Spirit Strike', 'Infectious Cloud', 'Shrink', 'Frenzy', 'Grow', 'Impassivity', 'Tiny Companion', 'Insidious Fever', 'Vision', 'Malaise', 'Spirit Strength', 'Spirit of Cat', 'Affliction', 'Cancel Magic', 'Endure Magic', 'Healing', 'Creeping Vision', 'Protect', 'Spirit of Cheetah', 'Spirit of Monkey', 'Spirit of Ox', 'Counteract Disease', 'Poison Storm', 'Scale of Wolf', 'Cannibalize', 'Frost Strike', 'Regeneration', 'Envenomed Breath', 'Remove Lesser Curse', 'Resist Cold', 'Befriend Animal', 'Form of the Bear', 'Rising Dexterity', 'Counteract Poison', 'Quickness', 'Ultravision', 'Invisibility', 'Resist Fire', "Tagar's Insects", 'Alluring Aura', 'Raging Strength', 'Tortoises Healing', 'Greater Healing', 'Imbue Amber', 'Imbue Diamond', 'Imbue Ivory', 'Imbue Jade', 'Imbue Sapphire', 'Listless Power', 'Mass Imbue Amber', 'Mass Imbue Diamond', 'Mass Imbue Ivory', 'Mass Imbue Jade', 'Mass Imbue Sapphire', 'Spirit of the Shrew', 'Fury', 'Health', 'Nonchalance', 'Resist Disease', 'Nimble', 'Scourge', 'Shifting Shield', 'Charm Animals', 'Companion Spirit', 'Malaisement', 'Talisman of Tnarg', 'Instill', "Winter's Roar", 'Curse', 'Pack Shrew', 'Shock of the Tainted', 'Resist Poison', 'Tumultuous Strength', 'Assiduous Vision', 'Gale of Poison', "Spirit of Bih'Li", 'Glamour', 'Venom of the Snake', 'Vigilant Spirit', 'Insidious Malady', 'Remove Curse', "Togor's Insects", 'Blinding Luminance', 'Chloroplast', 'Deftness', 'Furious Strength', 'Spirit Salve', 'Summon Companion', 'Talisman of Altuna', 'Agility', 'Guardian Spirit', 'Incapacitate', 'Alacrity', 'Blast of Poison', 'Guardian', 'Slugs Healing', 'Odium', 'Resist Magic', 'Stamina', 'Blizzard Blast', 'Nullify Magic', 'Stoicism', 'Frenzied Spirit', 'Rage', 'Superior Healing', 'Harnessing of Spirit', 'Strength', 'Charisma', 'Shock of Venom', 'Abolish Disease', 'Dexterity', 'Malosi', 'Envenomed Bolt', 'Infusion of Spirit', 'Plague', "Kragg's Salve", 'Spirit Quickening', 'Spirit of the Puma', 'Talisman of Jasinth'],

  WIZ: ['Ice Comet', "Elnerick's Entombment of Ice", 'Mana Detonation'],
};

/** Clases de las que hay lista. Fuera de aquí no se afirma nada. */
export const CLASES_CONOCIDAS = Object.keys(LISTAS);

/** hechizo -> clases que lo tienen, entre las conocidas. */
const DUENOS = new Map();
for (const [clase, hechizos] of Object.entries(LISTAS)) {
  for (const h of hechizos) {
    if (!DUENOS.has(h)) DUENOS.set(h, []);
    DUENOS.get(h).push(clase);
  }
}

/**
 * ¿Este hechizo demuestra que una clase estaba activa?
 *
 * Sólo si lo tiene UNA de las clases conocidas. Un hechizo compartido no
 * demuestra nada y devuelve null, igual que uno que no esté en ninguna lista.
 *
 * @returns {string|null} código de clase, o null
 */
export function proofOf(spell) {
  const d = DUENOS.get(spell);
  return d && d.length === 1 ? d[0] : null;
}

/** Para la interfaz: qué clases tienen este hechizo, de las conocidas. */
export function ownersOf(spell) {
  return DUENOS.get(spell)?.slice() ?? [];
}

/** Todos los hechizos de una clase conocida. Para pruebas y para la interfaz. */
ownersOf.byClass = (clase) => (LISTAS[clase] ?? []).slice();
