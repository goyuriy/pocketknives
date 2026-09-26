# Progression tree

What a player unlocks over time, how, and why it is built the way it is.
Backlog epic: **M2 · Progression tree** in [BACKLOG.md](../BACKLOG.md).

Status: 💡 design — nothing here is built yet. The knives it refers to exist
([knives.ts](../packages/core/src/throw/knives.ts)); grips do not.

---

## Principles

1. **Sidegrades, never upgrades.** Nothing unlocked throws better, only
   differently. Every knife and every grip is a trade — reach against
   forgiveness, precision against power — the same rule the knife rack already
   follows ([RULES.md](../RULES.md), *The knife*). A new player with the
   starting kit can beat a veteran; the veteran just has more ways to try.
2. **Unlock by doing, not by grinding.** The big unlocks are *trials* — a short
   feat that uses the thing being unlocked, or the skill it needs. Earning a
   grip is learning it. Experience points exist, but only buy looks.
3. **Real throwing first.** Grips are the ones knife throwers actually use, and
   they behave in the game the way they behave in a yard: a hammer grip is where
   everyone starts, a no-spin throw is the thing people practise for years.
4. **Nothing sold changes where a knife lands.** Money buys cosmetics and
   support only (BACKLOG, ground rule for M).

---

## Shape of the tree

Three branches that grow side by side. Levels come from playing; each branch
has its own gates.

```
             ┌─ Grips ─────────────────────────────────────────────┐
  start ──►  Hammer ──► Blade grip ──► Pinch ──► No-spin
                              └────► Two-handed (needs the Cleaver)

             ┌─ Knives ────────────────────────────────────────────┐
  start ──►  Thrower ──► Kitchen ──► Cleaver ──► Needle
                                        └────► Greatsword

             ┌─ Looks (experience levels) ─────────────────────────┐
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
| **Hammer** | Handle, whole hand. Full turns. | The baseline — today's throw. | ★☆☆☆ easiest | Start |
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
| Greatsword | Trial: claim half the circle in a single match | A showpiece. Earned, not reached by waiting. |

---

## Looks

Experience comes from playing matches (more for winning, some for every stick),
and each level unlocks something cosmetic: blade finishes, handle wraps, sleeve
colours, throw trails, stuck-knife flourishes, titles. This is the branch the
season pass (M6) extends later. It is the only branch money can touch.

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
