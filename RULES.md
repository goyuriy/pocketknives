# Pocket Knives — rules

The yard game: you throw a knife into the ground inside a circle, and the angle it
lands at decides how much of your neighbour's land you take.

This is the canonical statement of the rules. Where this document and the code
disagree, the document is what we meant — fix the code. Every rule below is
covered by a test in `packages/core/src/rules/cut.test.ts`.

---

## Setup

The arena is a circle, divided into equal wedges — one per player, two to four.

The circle is stored as a polygon with enough sides to read as round, so no rule
ever needs a special case for curves. Wedges are cut from the arena's own
vertices, so neighbouring borders share exact coordinates.

> `createBoard` — [board.ts](packages/core/src/rules/board.ts)

## A turn

One player throws. Then the turn passes — **always**, whether the throw won
ground or achieved nothing. A miss costs you your go. That is the pressure the
whole game runs on: there are no retries.

Eliminated players are skipped.

> `playTurn` — [turn.ts](packages/core/src/rules/turn.ts)

## The throw

**You move your hand; your hand throws the knife.** There is no cursor, no
crosshair and no preview of where it will land — only the knife in your fist,
pointing. Three decisions make a throw, and none of them is a reflex:

1. **Point.** You see through the thrower's eyes, your own two arms in front of
   you. Move the mouse across the screen and you turn with it, edge to edge
   being the arm's whole reach. Your free hand hangs at your side until you
   hold the button; then it comes up and points out along the line you are
   aiming — the way a javelin thrower sights down their free arm. The
   view follows a beat behind, the way a body-worn camera trails the arm. The
   hand wavers very slightly on its own; a patient player waits for it to
   settle.

   Up and down sets **how steeply** to throw, from a skimming 6° with the hand
   low to a 46° lob with it high — the free arm lifts to show it, and the HUD
   gives the number. The angle locks when you grip, because from then on up
   and down is the draw. It is a real choice, not a style: a flat throw is
   quick and dependable but cannot reach the far side; a lob reaches anywhere
   but stays up long enough for the hand's wobble to tell.

   | Angle | Full draw reaches | Sticks at full draw |
   | --- | --- | --- |
   | 6° (flat) | 12 | 98% |
   | 20° (resting) | 21 | 77% |
   | 46° (lob) | 29 | 59% |
2. **Draw.** Hold the button and pull back towards you. The knife cocks up by
   your ear, point still forward, like a dart. How far back is how hard it is
   thrown — a position, not a speed, so it means the same on a
   mouse, a trackpad and a thumb. The hand keeps turning with the mouse while
   the arm is back, so the line can be settled at full draw.
3. **Push through.** Push forward past the point where you gripped. Crossing
   that point is the release. Push straight and the knife goes where it
   pointed; push crooked and it pulls off line the way the push wandered, like
   a golf swing coming across the ball. The aim freezes where the push begins:
   sideways movement before that is re-aiming, after it is drift.

Drift back up slowly instead of pushing, or let go of the button, and the throw
is called off — the arm just eases back to rest.

This is the golf "swing stick" (pull back to load, push forward to strike)
fitted to a knife, with Bodycam's rule that you aim with the object, not with a
marker. The earlier control read the pace of a flick, which suited a phone and
fought a mouse: a desktop pointer's speed says more about the mouse's
sensitivity setting than about the player's intent.

> `advanceStroke`, `aimFromPointer` — [throwStroke.ts](apps/web/src/input/throwStroke.ts)
> `bodyPose`, `twoBoneIk` — [bodyPose.ts](apps/web/src/stage/math/bodyPose.ts), [twoBoneIk.ts](apps/web/src/stage/math/twoBoneIk.ts)
> `handSway` — [handSway.ts](apps/web/src/input/handSway.ts)
> `ThrowIntent`, `swingLaunch` — [swing.ts](packages/core/src/throw/swing.ts)

**The wrist is automatic.** Given the distance, the hand turns the knife by
exactly as much as that distance needs to bring it in point-first — aiming for
the middle of the range that sticks, not the edge of it. So a clean throw sticks
wherever it lands, and the question a turn asks is the one the circle is about:
*where* to cut.

An earlier version made the player control the tumble too, by how sharply the
stroke curled. It was more to learn than a casual game wants, and it made every
miss the player's wrist rather than their choice.

> `wristSpin`, `sweetSpotAngle` — [swing.ts](packages/core/src/throw/swing.ts)

**What still goes wrong is the hand.** Every throw carries a little seeded
wobble — in the tumble, and in the pace the wrist planned for — and the longer
the knife is in the air, the more that wobble grows. So reaching far is a risk,
not a free choice. With the Thrower:

| Throw | Reach | Sticks |
| --- | --- | --- |
| gentle | 6 | 99% |
| medium | 10 | 95% |
| hard | 15 | 87% |
| full | 21 | 77% |

The knife still **tumbles forward**, tip over the top and down, the way a thrown
knife does. Sticking asks three separate questions:

1. **Is the point the lowest part of the knife?** If the blade is tipped above
   horizontal, the butt of the handle strikes first.
2. **Is it travelling the way it points?** A knife arriving across its own path
   lands on its flat and skips.
3. **Has it enough left to bury the point?**

The first two are not the same test. A knife can be perfectly aligned with its
descending path and still have its tip above horizontal, whenever the path is
steeper than the knife.

Full power from the Thrower just reaches the far rim. A throw that fails to
stick costs the turn, like any other miss.

> `simulateFlight` — [flight.ts](packages/core/src/throw/flight.ts)
> `stickVerdict` — [stick.ts](packages/core/src/throw/stick.ts)

**The flight itself carries no randomness.** It is a closed-form arc with a
constant tumble — no drag, no physics engine — so a server and a client agree on
where the knife landed without replaying each other's floating point. The wobble
is applied before the flight, from a recorded seed (see below).

## Where you stand

You throw from your own ground, so the stretch of rim you still hold is the
stretch you may throw from — and you choose where along it to stand.

That gives rim frontage a value of its own. A player squeezed inland keeps their
area but loses their angles, and can end up holding plenty of ground with no line
on anybody. It also means an attack on someone's edge costs them more than the
land it takes.

The choice is stored as a fraction of frontage rather than an angle, so it
survives the ground moving underneath it: lose half your edge and you are still
standing proportionally where you were, not suddenly outside your own land.

> `ownedRimArcs`, `standingBearing` — [standing.ts](packages/core/src/rules/standing.ts)

## The knife

Chosen before the match, not during it: the knife is your strategy, the throw is
your execution. Each trades **reach** against **forgiveness**.

| Knife | Hands | Full reach | Sticks at full reach | Character |
| --- | --- | --- | --- | --- |
| Kitchen | 1 | 24 | 82% | Long in the blade and forgiving of a shaky hand. |
| Thrower | 1 | 21 | 77% | Weighted forward and even-tempered. |
| Cleaver | 1 | 16 | 91% | Heavy and slow to turn, buries itself to the handle. |
| Needle | 1 | 27 | 59% | Light and whirling. Flies furthest, forgives nothing. |
| Greatsword | 2 | 11 | 100% | Barely turns, drops point-first from anywhere — but only reaches the middle. |

Every difference is physical:

- **Weight** sets reach. The same arm throws a heavy blade slower — launch speed
  scales as `(referenceMass / mass) ^ weightPenalty`.
- **Blade length** sets forgiveness. A longer point reaches the ground first over
  a wider range of angles, so more of the wobble still sticks.
- **Mass and balance** set how many turns it makes on the way. The wrist picks
  the sticking tumble nearest the knife's natural one, so a cleaver turns once
  and a needle whirls ten times — the knife keeps its character even though
  nobody chooses its spin.
- **Edge width** sets how deep it bites.

A sword is held in two hands, and the player sees both on screen. That is how it
is held, not physics — the flight never reads it.

> `KNIVES` — [knives.ts](packages/core/src/throw/knives.ts)

## The cut

The knife lands at a point, with the blade facing some direction. The cut is a
straight line through that point, running **along the blade**, extended both
ways.

**The cut runs along the line you threw.** A tumbling knife turns within the
plane of its own flight and comes to rest in it, so the blade lies along the
bearing it was thrown on. You do not aim the line separately — where you stand
and where you aim *is* the line.

> `throwFromImpact` — [stick.ts](packages/core/src/throw/stick.ts)

**The line stops at the first border it meets.** Not at the rim — at whatever it
reaches first, which may be a neighbour's border or the edge of the circle. This
is what keeps a cut local to the ground it was thrown into.

> `firstBoundaryHit` — [raycast.ts](packages/core/src/geometry/raycast.ts)
> `splitRingByChord` — [split.ts](packages/core/src/geometry/split.ts)

## Claiming

The cut divides the victim's ground in two. Which half you take is decided by
two rules, in order:

### 1. Your side of the line

**You take the half on the same side of the cut as your own land.** Your
territory grows *up to* the blade; it never jumps across it.

Size has nothing to do with it. A cut that slices the corner off a neighbour
hands you that corner — not the larger remainder — even when both halves touch
you.

### 2. It has to connect

That half must share a real stretch of border with ground you already hold. A
throw to the far side of the circle wins nothing, however well it lands.

If the half on your side does not connect to you, the throw takes nothing.

> `pickClaimablePiece` — [cut.ts](packages/core/src/rules/cut.ts)

## No islands

**A player's holdings are one connected field, or they are not theirs.**

A cut can sever that field: take the stretch of border that was joining two of
someone's pieces and the far piece is left landlocked, with no route home.
Ground you cannot walk to from your own land is ground you have lost.

Stranded ground goes to the neighbour holding the **longest border** with it.
That is usually the thrower, whose cut did the stranding — but a pocket wedged
mainly against a third player goes to them instead.

This makes cutting an opponent's supply line a real move: a throw can be worth
far more than the piece the blade actually carved off.

> `absorbOrphans` — [orphans.ts](packages/core/src/rules/orphans.ts)

## Elimination and winning

You are out when **you can no longer stand on your own land** — when no field
you hold can still contain a circle of the standing radius.

Not "you own nothing". A player whittled down to slivers is out while still
technically holding ground. This mirrors the yard rule and stops matches from
dragging on over crumbs.

The last player standing wins the circle.

> `isAlive`, `winner` — [turn.ts](packages/core/src/rules/turn.ts)

## Every way a throw fails

All of these cost the turn. None allow a retry.

| Reason | What happened |
| --- | --- |
| `outside_arena` | The knife landed outside the circle. |
| `own_territory` | The knife landed on your own ground. |
| `no_connection` | The half on your side doesn't touch land you hold. |
| `degenerate_cut` | No clean cut there — landed exactly on a border, or the line grazes a single edge. |

And the ways it fails before the rules are consulted at all — the knife never
stuck, so there was no line to draw:

| Reason | What happened |
| --- | --- |
| `handle_first` | The hand wobbled; the knife came in under-turned and the butt struck first. |
| `flat` | The hand wobbled the other way; it arrived across its own path and skipped. |
| `too_slow` | Nothing left in it to bury the point. |

A clean throw never fails these — the wrist sees to it. They are the hand's
wobble, and the lever a player has on them is how far they reach.

---

## Invariants

Properties that must hold after every turn. Worth asserting as the rules grow —
they kill whole classes of bug before they appear.

1. **Area is conserved.** The territories always sum to the area of the circle.
   Ground is never created or destroyed, only transferred.
2. **One field per player.** Every player holds exactly one connected field, or
   nothing. Guaranteed by the connection rule (your gains stay attached) plus the
   no-islands rule (your losses can't strand you).
3. **Territories stay convex.** Wedges of a disc are convex, and a chord cut of a
   convex shape yields two convex shapes. Several bits of geometry rely on this —
   notably that a piece lies wholly on one side of the cut line, which is what
   makes the side-of-line test exact rather than approximate.
4. **Resolving a throw is pure and deterministic.** Same board plus same throw
   always yields the same result, on any machine. Required for an authoritative
   server and a client to agree without replaying each other's floating point.

## Tunable constants

In `RuleSet` — kept out of the geometry so they can be balanced without touching
it. Values are in arena units, where the arena radius is 10.

| Name | Default | Meaning |
| --- | --- | --- |
| `standRadius` | 0.6 | Smallest circle a player must be able to fit on their land to stay in the game. |
| `minSharedBorder` | 0.05 | Shortest stretch of border that counts as a real connection. Stops a claim resolving on a single touching corner. |

Everything about the throw lives in one file:
[config.ts](packages/core/src/throw/config.ts). The sandbox exposes it as live
dials — press **Tune** — with the derived numbers shown above the sliders, and a
**Copy JSON** button to paste a tuned config back into the file.

| Group | Fields | What it decides |
| --- | --- | --- |
| `knife` | `bladeLength`, `handleLength`, `mass`, `balance`, `edgeWidth` | The object itself |
| `gesture` | `fullDraw`, `minDraw`, `minPushSpeed`, `maxAim`, `driftGain`, `minPitch`, `maxPitch` | How the hand's motion is read |
| `style` | `pitch`, `spinImpulse`, `startingBladeAngle`, `releaseHeight`, `minSpeed`, `maxSpeed`, `referenceMass`, `weightPenalty` | How the arm throws |
| `scatter` | `spin`, `power`, `startingBladeAngle`, `heading` | How much the hand wobbles (seeded) |
| `stick` | `baseMisalignment`, `minEntryAngle`, `minMomentum`, `soilResistance` | What the ground accepts |
| `flight` | `gravity`, `sampleInterval` | The world |

Derived, and read through helpers so there is one definition of each:

- **natural tumble** = `spinImpulse / momentOfInertia`. Decides how many turns a
  throw makes, not whether it sticks.
- **reach factor** from mass — see the knife section.
- **stick window** scales with blade length.
- **bite depth** from mass, impact speed and edge width, capped at the blade.

`scatter.spin` is the main difficulty dial: it is the wobble that grows with
flight time. `scatter.heading` stays at zero on purpose — where the knife goes is
the player's decision, and wobbling the aim would only take it away.

### Scatter is seeded, always

A throw is recorded as an aim, a pitch, a draw, a drift and a **seed**. Feed the same five
back in anywhere — another machine, a server checking a client, a replay months
later — and the knife lands in exactly the same place. Nothing reaches for a
global random source, because randomness that cannot be replayed would make a
throw impossible to verify and the game impossible to referee.

There is no aiming preview. The knife in the hand is the aim.

## Not settled yet

- **The reach rule.** In the yard game you must be able to reach the knife while
  keeping a foot on your own land, which caps how far one throw can claim.
  Nothing implements this yet, so a deep throw currently pays maximally: cut
  anywhere in an opponent's ground and you take everything between the blade and
  your border. `RuleSet` is open for it when we decide.
- **Roll.** The knife currently tumbles strictly within its flight plane, so the
  cut always runs along the throw. Letting a player put a twist on it would free
  the line from the aim — more control, and a third thing to learn. Deliberately
  left out until the point-draw-push version has been played.
