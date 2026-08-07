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

You control two things: **where you aim**, and **how hard you throw**. Pitch and
spin are fixed — a player throws the way they throw.

The knife tumbles end over end at a steady rate the whole way. It sticks only if
it arrives **blade-first** — pointing the way it is travelling. A knife that
arrives across its path lands on its flat and skips away, and throwing harder
only makes it skip further.

Since flight time is set by power and the tumble runs at a fixed rate, **how far
you throw decides where in its rotation the knife arrives**. This has a
consequence that shapes the whole game:

> **You cannot stick the knife at an arbitrary distance.** There are two bands of
> power that land it blade-first, together covering roughly a quarter of the
> range. Everything between them bounces.

So the tactical question is never "how far can I reach" but "which band reaches
into which opponent, from where I stand". You throw from just outside the rim on
the bearing of your own ground, so your position decides which enemies your bands
can touch.

**The two bands are not equally useful, and at the opening position they are not
both offensive.** Measured from a four-player start, the short band reaches 4
units and lands at radius 8 on your own bearing — inside your own wedge, wherever
you aim it. Only the long band, reaching 15 units past the centre, can take
ground on the first turn. The short band becomes worth having later, once an
enemy holds land near you. Whether that is the right shape for the game, or
whether both bands should threaten from the start, is an open tuning question —
moving the stand-off, the spin, or the power range all shift it.

Full power just reaches the far rim. Nobody is drawn standing there — the circle
is what you watch — but the throw starts from a player's own side, and that is
what makes position matter.

> `aimedLaunch` — [launch.ts](packages/core/src/throw/launch.ts)
> `simulateFlight` — [flight.ts](packages/core/src/throw/flight.ts)
> `stickVerdict` — [stick.ts](packages/core/src/throw/stick.ts)

A throw that fails to stick costs the turn, like any other miss.

**The flight carries no randomness.** It is a closed-form arc with a constant
tumble — no drag, no wobble, no physics engine. That is deliberate: a server and
a client must agree on where the knife landed without replaying each other's
floating point, and a physics engine cannot promise that.

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
| *didn't stick* | The blade arrived across its path and skipped away. Decided before the rules are consulted at all. |

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
dials — press **Tune** — with the derived numbers and the current bands shown
above the sliders, and a **Copy JSON** button to paste a tuned config back into
the file.

**The knife is a physical object, and its physics really do drive the game.**
Nothing in the config is decorative; each field feeds a derived quantity, so a
change to mass or blade length changes how the knife tumbles, how forgiving the
stick is, and how deep it buries.

| Group | Fields | What it decides |
| --- | --- | --- |
| `knife` | `bladeLength`, `handleLength`, `mass`, `balance`, `edgeWidth` | The object itself |
| `style` | `pitch`, `spinImpulse`, `startingBladeAngle`, `releaseHeight`, `minSpeed`, `maxSpeed` | How a player throws it |
| `scatter` | `heading`, `power`, `spin`, `startingBladeAngle` | How badly (all seeded — see below) |
| `stick` | `baseMisalignment`, `minMomentum`, `soilResistance` | What the ground does about it |
| `flight` | `gravity`, `sampleInterval` | The world |

Derived, and read through helpers so there is one definition of each:

- **tumble rate** = `spinImpulse / momentOfInertia`. The same flick of the wrist
  spins a light knife faster than a heavy one.
- **stick window** scales with blade length. A longer point leads further ahead
  of the knife's centre and so reaches the ground over a wider range of angles.
- **bite depth** from mass, impact speed and edge width, capped at the blade.

### Three levers that change the game, not just the numbers

Measured from a four-player start:

| Knife | Tumble | Bands |
| --- | --- | --- |
| default | 24 rad/s | 1–18%, 70–82% |
| heavy (`mass` 0.4) | 12 rad/s | 0–16% — barely rotates, so it only sticks up close |
| light (`mass` 0.1) | 48 rad/s | 11–18%, 45–51%, 75–81% — three narrow bands, much harder |
| long blade (0.84) | 11 rad/s | 0–43% — nearly half the range sticks, very forgiving |

These interact, so **retune by sweeping and reading the bands**, never by nudging
one number and hoping. `stickingBands` is that sweep, and the panel runs it live.

### Scatter is seeded, always

A throw is recorded as an aim, a power and a **seed**. Feed the same three back
in anywhere — another machine, a server checking a client, a replay months later
— and the knife lands in exactly the same place. Nothing reaches for a global
random source, because randomness that cannot be replayed would make a throw
impossible to verify and the game impossible to referee.

Spreads default to zero. An obedient knife is the right starting point for tuning
everything else, and the aiming preview is drawn unscattered on purpose — it
shows what the player is aiming at, not the error their hand is about to make.

## Not settled yet

- **The reach rule.** In the yard game you must be able to reach the knife while
  keeping a foot on your own land, which caps how far one throw can claim.
  Nothing implements this yet, so a deep throw currently pays maximally: cut
  anywhere in an opponent's ground and you take everything between the blade and
  your border. `RuleSet` is open for it when we decide.
- **Roll.** The knife currently tumbles strictly within its flight plane, so the
  cut always runs along the throw. Letting a player put a twist on it would free
  the line from the aim — more control, and a third thing to learn. Deliberately
  left out until the two-dial version has been played.
