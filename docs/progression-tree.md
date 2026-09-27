# Progression tree

What a player unlocks over time, how, and why it is built the way it is.
Backlog epic: **Progression tree** in [BACKLOG.md](../BACKLOG.md).

Status: 💡 design — nothing here is built yet. The knives it refers to exist
([knives.ts](../packages/core/src/throw/knives.ts)); grips do not.

---

## Principles

1. **What you choose is a sidegrade; your character grows.** No knife or grip
   throws better, only differently. Every one is a trade — reach against
   forgiveness, precision against power — the same rule the knife rack already
   follows ([RULES.md](../RULES.md), *The knife*). The character is different:
   it gets slightly better the more you play, through passive skills bought
   with character levels (see *Skills*). That growth is small and always
   visible, so a new player can still beat a veteran.
2. **Unlock by doing, not by grinding.** Grips and the Greatsword are unlocked
   by *trials* — a short feat that uses the thing being unlocked, or the skill
   it needs. Earning a grip is learning it. Experience raises your character
   level, and levels buy looks and skill points.
3. **Real throwing first.** Grips are the ones knife throwers actually use, and
   they behave in the game the way they behave in a yard: a hammer grip is where
   everyone starts, a no-spin throw is the thing people practise for years.
4. **Nothing sold changes where a knife lands.** Money buys cosmetics and
   support only (BACKLOG, ground rule for M).

---

## Shape of the tree

Five branches that grow side by side. Levels come from playing; each branch
has its own gates.

```
             ┌─ Grips ─────────────────────────────────────────────┐
  start ──►  Hammer ──► Blade grip ──► Pinch ──► No-spin
                              └────► Two-handed (needs the Cleaver)

             ┌─ Throws ────────────────────────────────────────────┐
  start ──►  Overhand ──► Underhand (reverse spin)

             ┌─ Knives ────────────────────────────────────────────┐
  start ──►  Thrower ──► Kitchen ──► Cleaver ──► Needle
                                        └────► Greatsword

             ┌─ Skills (passive, character levels 3–20) ───────────┐
  start ──►  Long hands 1 ──► 2 ──► 3 ──► 4 ──► 5

             ┌─ Looks (character levels) ──────────────────────────┐
  start ──►  blade finishes · handle wraps · sleeves · trails · titles
```

The grip and knife branches cross in two places, deliberately: the
**Two-handed** grip needs a heavy knife to be worth anything, so it waits for
the Cleaver; and the **No-spin** grip is what makes the Needle's reach usable,
so the two are meant to arrive close together.

---

## Grips

### What they are in real life

A thrower has two basic ways to hold a knife, and a specialist third:

- **By the handle** — the knife starts pointing at the target and must make a
  whole number of full turns to arrive point-first. About one turn per 3.7–4.6 m.
- **By the blade** — it starts pointing back at the thrower and needs an odd
  number of *half* turns. The half-turn throw works from about 2–2.4 m, which
  is why it is usually the first technique taught.
- **No-spin** — the index finger lies along the spine and the release is a
  straight push, so the knife flies a quarter-turn or less. It works at almost
  any distance (sport throwers stick no-spin throws from 18 m), but it is the
  hardest to learn and the least stable in flight. Fedin, Skanai and Thorn are
  the best-known schools.

How the fingers close matters too: a **hammer** grip wraps the whole hand round
the handle and suits heavy knives; a **pinch** grip holds it between thumb and
index finger and suits light, precise blades.

### The grips in the game

Each grip changes how the hand throws, as a set of adjustments to the throw
config — never to the rules of the ground. Numbers are starting points for
tuning, not final.

| Grip | Real life | What it does in the game | Learning (real) | Unlock trial |
| --- | --- | --- | --- | --- |
| **Hammer** | Handle, whole hand: the handle diagonally across the palm, fingers round it, thumb along its side, the knife standing up out of the fist. Full turns. | The baseline — today's throw, and the grip the character holds. | ★☆☆☆ easiest | Start |
| **Blade grip** | By the blade, half turns, close range. | Knife starts reversed and lands after odd half-turns. Short throws forgive more (≈ +30% stick window below 40% draw); long throws lose reach (≈ −15% top speed). A close-quarters specialist. | ★☆☆☆ the usual first lesson | Stick 3 throws in a row with under 40% draw |
| **Pinch** | Thumb and finger. Light blades, precision. | Half the hand's sway, a straighter push (drift pull ×0.6), a little less power (≈ −10% speed). Heavy knives (mass above 0.3) wobble more in a pinch. | ★★☆☆ | Stick 5 throws with the push under 5° of drift |
| **Two-handed** | Overhead with both hands — how heavy blades are thrown. | For heavy knives only: halves the weight penalty on reach, slower to draw back fully. Makes the Cleaver a long-range threat. | ★★☆☆ | Win a match with the Cleaver |
| **No-spin** | Finger on the spine, straight push, quarter-turn. | The knife barely turns, so distance no longer decides where in its turn it arrives — the most reach and the flattest, fastest flight in the game. The price: three times the grip wobble, and a crooked push hurts half as much again. The mastery grip. | ★★★★ hardest, least stable | Stick 10 throws past the centre of the circle, having unlocked Pinch |

**Why these trade-offs.** Each one is what the grip is actually good and bad at,
turned into the dial the game already has: the blade grip really is a
short-distance throw, a pinch really is more precise and less powerful, a
no-spin throw really does trade stability for reach. Players who throw in real
life should recognise them; players who don't learn something true.

**What the player sees.** The grip changes the hands on screen: fingers wrapped
or pinched, the knife held by its blade in the blade grip, the index finger laid
along the spine for no-spin, both fists on the handle for two-handed. The grip
is visible before every throw, so an opponent can read what is coming.

### Grip mastery

Each grip has three mastery ranks, earned by sticking throws with it. Ranks buy
looks only — a trail colour, a flourish on the stuck knife, a title ("Half-spin
Specialist"). They never touch the numbers above.

---

## Throws

A grip is how the knife sits in the hand; a throw is the path the arm takes.
They combine: any grip can be thrown either way.

| Throw | Real life | What it does in the game | Learning (real) | Unlock trial |
| --- | --- | --- | --- | --- |
| **Overhand** | The hand comes over from behind the shoulder and down; the knife turns forward, tip over the top. | Today's throw. | ★☆☆☆ | Start |
| **Underhand** | The hand swings up from below the hip and lets go on the way up, flicking the knife backwards: heavy reverse spin, the tip coming back under. A yard trick for sticking a knife close in front of you. | The knife spins backwards (negative spin), so the wrist's sticking rungs run the other way. Short and steep only — the swing has no power to throw far. Scatter on the spin is doubled: a backward flick is hard to judge. The throw looks different, so an opponent sees it coming. | ★★★☆ | Stick 5 throws in a row within one stride of your feet |

**Why it is a sidegrade.** Reverse spin reaches no further and forgives less;
what it buys is a different angle of entry, which lets a knife go in where a
forward tumble would skip — and the style of doing it.

---

## Character level

Experience comes from playing matches: some for every stick, more for every
claim, most for winning. It fills the character's level. Every level unlocks
something to wear (see *Looks*), and some levels also give a **skill point**:

| Character level | 3 | 6 | 10 | 15 | 20 |
| --- | --- | --- | --- | --- | --- |
| Skill point | 1st | 2nd | 3rd | 4th | 5th |

The gaps widen on purpose. The first point comes in the first evening of play;
the fifth is weeks away.

---

## Skills

Passive skills are always on and never chosen per throw. Each has five levels,
and a skill point raises one skill by one level. There is one skill so far, so
every point goes to it; once there are more, the player chooses where each
point goes.

### Long hands

You can reach further from your own ground to draw the line. The reach rule
([RULES.md](../RULES.md), *Within reach*) says a knife only claims ground if it
lands within `reach` of land you hold. Long hands adds to that reach. Each level
adds a little more than the one before it, so the last levels are the ones
worth chasing.

| Level | Adds | Reach (from 5) | Earliest at character level |
| --- | --- | --- | --- |
| 1 | +2% | 5.10 | 3 |
| 2 | +3% | 5.25 | 6 |
| 3 | +4% | 5.45 | 10 |
| 4 | +5% | 5.70 | 15 |
| 5 | +6% | 6.00 | 20 |

Numbers are starting points for tuning, not final. The percentages are of the
base reach, so level 5 is +20% altogether.

**How it is built** (in the sandbox now, set by hand from the debug row until
levels are earned). `RuleSet.reach` stays the base, the same for everyone. A
player's reach is the base times their Long hands factor (`longHandsReach`), and `resolveThrow`
and the chalked reach line both read the player's own reach. Everyone can see
that line, so an opponent's longer arms are always visible, never a surprise.

**Why this shape.** Getting slightly better over time is the point: it is
what a returning player has to show for coming back. It stays small, and it
only moves a line everyone can see. It never touches the throw itself:
sticking, spin, wobble and power are all unchanged. And it is never sold
(principle 4); only playing raises it.

---

## Knives

The five knives already built, each measured in [RULES.md](../RULES.md). The
branch only decides the order a new player meets them in — lightest lesson
first, most specialised last.

| Knife | Unlocks at | Why then |
| --- | --- | --- |
| Thrower | Start | Even-tempered; nothing it does surprises you. |
| Kitchen | Level 2 | More forgiving, less reach — a first taste of the trade-off. |
| Cleaver | Level 4 | Heavy: short, steady, buries itself. Opens the Two-handed grip. |
| Needle | Level 6 | Longest reach, forgives nothing — wants the Pinch grip. |
| Greatsword | Character level 30, then a trial: claim half the circle in a single match | A showpiece, and the one two-handed weapon. Held back until much later: two-handed throwing is not finished, and it should arrive as an event, not a starter. Shown locked in the rack until then. |

---

## Looks

Every character level (see *Character level*) unlocks something cosmetic:
blade finishes, handle wraps, sleeve colours, throw trails, stuck-knife
flourishes, titles. This is the branch the
**Season pass** extends later. It is the only branch money can touch.

---

## Open questions

- **Choosing a grip per throw or per match?** Per match keeps the pre-game choice
  meaningful (the knife and grip are the strategy, the throw is the execution);
  per throw adds depth but also a decision on every turn. Start per match.
- **Trials in multiplayer.** Trials should count in any mode, but a trial that
  can be farmed against friends needs care — e.g. only count matches against
  opponents at a similar level, or bots.
- **Grip unlocks for returning players** who already know the game from another
  device: a short skill check to skip ahead, rather than replaying trials.

---

## Sources

- [How To Hold A Throwing Knife — Knife Depot](https://blog.knife-depot.com/how-to-hold-a-throwing-knife/)
- [Knife Throwing Techniques – Pinch Grip Vs Hammer Grip — Throw Ninja Star](https://www.throwninjastar.com/knife-throwing-pinch-vs-hammer-grip/)
- [Knife throwing — Wikipedia](https://en.wikipedia.org/wiki/Knife_throwing)
- [No Spin Knife Throwing: Styles, Knives, and History — knifethrowing.info](https://www.knifethrowing.info/no_spin_knife_throwing.html)
- [Knife Throwing Techniques – Spin Vs No Spin — Throw Ninja Star](https://www.throwninjastar.com/knife-throwing-spin-vs-no-spin/)
- [The Art of the Throw: Stance and Distance — HowStuffWorks](https://entertainment.howstuffworks.com/arts/circus-arts/knife-throwing4.htm)
- [Throwing Knife Techniques (Beginner to Expert) — IKTHOF](https://ikthof.com/throwing-knife-techniques/)
- [Two Great No-Spin Knife-Throwing Tutorials — AllOutdoor](https://www.alloutdoor.com/2018/03/14/two-great-no-spin-knife-throwing-tutorials/)
