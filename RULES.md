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

A throw is only taken from the player whose turn it is, standing on their own
ground; anything else is turned down and changes nothing. The match is over,
and takes no more throws, once one player is left standing. (In the sandbox
the turn can be kept, to practise.)

> `applyCommand` — [apply.ts](packages/core/src/game/apply.ts), and ARCHITECTURE.md for how commands work
> `nextLivePlayer`, `playTurn` — [turn.ts](packages/core/src/rules/turn.ts)

## The throw

**You move your hand; your hand throws the knife.** There is no cursor, no
crosshair and no preview of where it will land — only the knife in your fist,
pointing. Three decisions make a throw, and none of them is a reflex:

1. **Point.** You see through the thrower's eyes, your own two arms in front of
   you: the same character every other camera shows, its head out of the way. Move the mouse across the screen and you turn with it, edge to edge
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
   | 6° (flat) | 8.7 | 97% |
   | 20° (resting) | 13.7 | 81% |
   | 46° (lob) | 17.9 | 64% |

   Reach is measured from where the knife leaves the hand. From the middle of
   a quarter of the circle the far rim is about fifteen away: only a lob gets
   there. But a knife only claims ground if it lands within reach of your own
   (see *Within reach*), so how far you can throw matters much less than how
   near you can land it.
2. **Draw.** Hold the button and pull back towards you. The knife is held in a
   hammer grip, the first grip every thrower learns: the handle diagonally
   across the palm, fingers round it, the thumb along its side, the knife
   standing up out of the fist. Drawn back, the fist goes up by your ear and
   the knife stands nearly upright, its tip still just in view. How far back is how hard it is
   thrown — a position, not a speed, so it means the same on a
   mouse, a trackpad and a thumb. The hand keeps turning with the mouse while
   the arm is back, so the line can be settled at full draw.
3. **Push through.** Push forward past the point where you gripped. Crossing
   that point is the release. Push straight and the knife goes where it
   pointed; push crooked and it pulls off line the way the push wandered, like
   a golf swing coming across the ball. The aim freezes where the push begins:
   sideways movement before that is re-aiming, after it is drift.

   **How fast you push is how hard it spins.** A gentle push turns the knife
   lazily; a sharp whip sends it whirling — from about half its natural tumble
   to over twice it. The wrist still picks a spin that sticks, the nearest one
   to what the push asked for, so a clean throw sticks either way. But the
   faster a knife spins, the more a wobble in pace turns into a wrong angle on
   landing, so the whip is a risk as well as a flourish:

   | Push | Thrower turns | Sticks | Needle turns | Sticks |
   | --- | --- | --- | --- | --- |
   | gentle | 1.3 | 82% | 3.3 | 68% |
   | middling | 4.3 | 81% | 12.3 | 58% |
   | full whip | 7.3 | 77% | 20.3 | 47% |

   (Full draw at the resting angle.)

**Letting go mid-push throws too.** On a phone the natural motion is to pull back
and flick, and the thumb leaves the glass during the flick — rarely after it has
come all the way back to where it touched. So a push that is under way, fast,
and has come back at least a third of the way when the finger (or button) lets
go throws exactly as if it had carried on through the grip point.

Drift back up slowly instead of pushing, or let go while still or pulling back,
and the throw is called off — the arm just eases back to rest.

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
| quarter draw | 4.1 | 99% |
| half draw | 6.7 | 96% |
| three-quarters | 9.9 | 89% |
| full draw | 13.7 | 81% |

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

**You must be able to catch it by the handle.** This is the yard's own rule, the
one every argument over a throw came down to: a knife only counts if it stands
up well enough to be pulled out by the handle. It must leave room to get two fingers under the handle (the butt at
least `grabClearance` off the ground). A knife that went in but lies nearly
flat has not stood up in the ground. It stays where it went in, and claims
nothing.

How high the handle stands depends on two things: the angle the knife went in
at, and how much of it is left above the ground. So a knife buried deep has to
stand steeper than one that barely went in, and a short knife has to stand
steeper than a long one. For a Thrower at its usual depth that means better
than about 10°. The Needle, being short and sinking deep, needs about 15°.

The wrist knows this rule too. It aims to bring the knife in steep enough for
the handle to clear, planning for the deepest the point could go, so a clean
throw is always one you could catch by the handle. What pushes a knife below
the line is under-turning, the same wobble that lands a worse one handle-first.

> `stickVerdict` — [stick.ts](packages/core/src/throw/stick.ts)
> `grabAngle` — [config.ts](packages/core/src/throw/config.ts)
> `sweetSpotAngle` — [swing.ts](packages/core/src/throw/swing.ts)

**The flight itself carries no randomness.** It is a closed-form arc with a
constant tumble — no drag, no physics engine — so a server and a client agree on
where the knife landed without replaying each other's floating point. The wobble
is applied before the flight, from a recorded seed (see below).

## Where you stand

**You walk your own ground, and throw from wherever you stand on it.** You can
go anywhere your land reaches and nowhere else: walk into your border and you
slide along it rather than crossing. Your feet must be on your own ground when
you let go; your arm reaches out in front of you, and may reach over the border,
as it does in the yard.

That makes the shape of your land matter twice. Ground that pushes towards an
opponent is ground you can walk out on and throw short from; losing it pushes
you back and makes every throw longer. A thin strip of land is a road as well as
an asset. And your reach is measured from your ground, so every stretch of it
pushes the reach out with it.

Each turn starts in the middle of your largest piece, facing the centre of the
circle. If the ground under your feet is taken, you are put back home.

**Controls.**

| | Walk | Turn and aim | Angle | Throw |
| --- | --- | --- | --- | --- |
| Mouse and keys | WASD or arrow keys | Mouse across (click to capture the mouse, Esc to release) | Mouse up and down | Hold, pull back, push through — across still turns while drawn |
| Gamepad | Left stick | Right stick across | Right stick up and down | Hold the right trigger (or bumper): the right stick becomes a swing stick — pull back, push up past the grip point. Across still turns. |
| Touch | A floating stick: put a thumb down on the left of the screen | Drag sideways from wherever the finger lands on the right — never where it lands | Where the finger comes down | The same drag: pull back, flick forward and let go |

These follow what players already know from games that do it well. Mouse-look
with a captured pointer is the standard in every first-person browser game — a
visible cursor stops turning dead at the edge of the screen. Holding a button to
make the mouse into a swing is how golf games play on PC. The touch split — move
with the left thumb, aim-and-release with the right — is Brawl Stars', and a stick
that floats to wherever the thumb lands is the one players find easiest to learn.
Your feet stay planted while the button is held, so the grip point means
something.

The gamepad's grip point sits a quarter of the way *up* the stick, not at its
centre. A stick springs back to centre when it is let go, and a grip point at
the centre would turn every released pull into a throw; this way a throw has to
be pushed through on purpose.

> `isOnOwnLand`, `keepOnOwnLand`, `homeSpot` — [standing.ts](packages/core/src/rules/standing.ts)
> `walkStep`, `walkFromStick` — [walk.ts](apps/web/src/input/walk.ts)
> `useThrowControls` — [useThrowControls.ts](apps/web/src/stage/useThrowControls.ts)
> `useGamepadThrow`, `padSample` — [useGamepadThrow.ts](apps/web/src/stage/useGamepadThrow.ts), [gamepadSwing.ts](apps/web/src/input/gamepadSwing.ts)

## Knives on the ground

Every knife thrown stays where it fell, for the rest of the match (the oldest is
picked up once there are sixteen). A stuck knife is solid — you walk round it,
not through it. So is one that went in but lies too low to catch by the handle;
it stands where it went in, dimmed, because it claims nothing. A knife that did not stick is handed to the physics engine the
moment it lands: it kicks off the ground the way it arrived, bounces and settles
for real, and can be kicked about afterwards.

None of that decides anything. A knife that did not stick claimed nothing, and
one that stuck has already cut; the physics is for the eye and the feet.

> `createGroundKnives` — [groundKnives.ts](apps/web/src/stage/views/groundKnives.ts)
> `rebound` — [rebound.ts](apps/web/src/stage/math/rebound.ts)
> `createWalker` — [walker.ts](apps/web/src/stage/views/walker.ts)

## The knife

Chosen before the match, not during it: the knife is your strategy, the throw is
your execution. Every knife is its real size and weight, in metres and
kilograms: the Thrower is 30 cm and 200 g. Each trades **reach** against **forgiveness**.

| Knife | Hands | Full reach | Sticks at full reach | Character |
| --- | --- | --- | --- | --- |
| Kitchen | 1 | 15.1 | 87% | Long in the blade and forgiving of a shaky hand. |
| Thrower | 1 | 13.7 | 81% | Weighted forward and even-tempered. |
| Cleaver | 1 | 10.2 | 92% | Heavy and slow to turn, buries itself to the handle. |
| Needle | 1 | 17.0 | 62% | Light and whirling. Flies furthest, forgives nothing. |
| Greatsword | 2 | 7.6 | 100% | Barely turns, drops point-first from anywhere — but only reaches so far. Locked until character level 30; two-handed throwing is parked. |

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

## Within reach

**You can only draw the line if the knife is near you.** In the yard you draw
the cut yourself, down the blade, with a foot still on your own land, so a knife
you cannot reach draws nothing, however well it stuck. Here that is a distance:
the knife has to land within `reach` (5, half the circle's radius) of ground you
hold. Otherwise the throw misses as `out_of_reach`, and no line is drawn.

It is measured from the nearest of your ground, not from where you stood to
throw. That is the yard's version, where you walk to the knife along your own
land to draw the line. So throwing from deep inside your land is allowed, as
long as the knife comes down near its edge.

This is what keeps a turn local. Without it, a deep throw paid best: a knife
stuck anywhere in an opponent's ground took everything between the blade and
your border, so the far rim was the best place to aim. Now you take ground next
to your own, a strip at a time, and the long throw that reaches across the
circle wins nothing.

The edge of your reach is chalked on the ground in your colour as a dotted line,
all the way round your land. That is a fact about the board, not a preview of
the throw. Nothing shows where the knife will land. The **reach** switch in the
debug row hides it, for seeing the ground bare.

> `distanceToLand` — [standing.ts](packages/core/src/rules/standing.ts)
> `resolveThrow` — [cut.ts](packages/core/src/rules/cut.ts)
> `reachDots` — [reachLine.ts](apps/web/src/stage/math/reachLine.ts)

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

**A border is where someone else's ground begins** — not a seam inside the
victim's own field. Ground won over several turns is stored as several pieces,
but on the ground it is one field, drawn as one, and the line runs straight
across the joins between its pieces. Every piece it crosses is split.

This was once a bug worth remembering: the line stopped at the first edge of
whichever *piece* the knife hit, including the invisible seams. A player whose
centre had been taken could never win it back, because the piece the knife
landed in was not the piece touching them.

> `cutField` — [fieldCut.ts](packages/core/src/rules/fieldCut.ts)
> `firstBoundaryHit` — [raycast.ts](packages/core/src/geometry/raycast.ts)
> `splitRingByChord` — [split.ts](packages/core/src/geometry/split.ts)

## Claiming

The cut divides the victim's field in two sides. Which side you take is decided
by two rules, in order:

### 1. Your side of the line

**You take the half on the same side of the cut as your own land.** Your
territory grows *up to* the blade; it never jumps across it.

Size has nothing to do with it. A cut that slices the corner off a neighbour
hands you that corner — not the larger remainder — even when both halves touch
you.

### 2. It has to connect

That side must share a real stretch of border with ground you already hold. A
throw to the far side of the circle wins nothing, however well it lands.

If the side facing you does not connect to you, the throw takes nothing.

> `pickClaimablePiece` — [cut.ts](packages/core/src/rules/cut.ts)

## Tidying up

After every claim, neighbouring pieces of the same player are joined back into
one wherever the join is still convex. Without it a cut that crosses a field of
many pieces splits every one of them, and over a match the board fragments into
hundreds of slivers — a random 67-turn match reached 284 pieces, and the worst
turns took nearly half a second to resolve. With it the same matches stay
under about 20 pieces and every turn resolves in a few tens of milliseconds.

> `mergeConvexNeighbours` — [tidy.ts](packages/core/src/rules/tidy.ts)

## No islands

**A player's holdings are one connected field, or they are not theirs.**

A cut divides the victim's field into two sides, and each side is everything
joined to it through the victim's own ground. So whatever you take, what the
victim keeps is still in one piece — a cut cannot leave them an island, and
cutting across an opponent's supply line takes everything that line was
feeding, on your side of it, in one throw.

If ground were ever stranded all the same, it goes to the neighbour holding the
**longest border** with it. Since cuts started crossing whole fields this is a
safety net rather than a rule anyone meets in play.

> `cutField` — [fieldCut.ts](packages/core/src/rules/fieldCut.ts)
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
| `out_of_reach` | The knife landed too far from your ground to draw the line. |
| `no_connection` | The half on your side doesn't touch land you hold. |
| `degenerate_cut` | No clean cut there — landed exactly on a border, or the line grazes a single edge. |

And the ways it fails before the rules are consulted at all — the knife never
stuck, or never stood up well enough to count, so there was no line to draw:

| Reason | What happened |
| --- | --- |
| `handle_first` | The hand wobbled; the knife came in under-turned and the butt struck first. |
| `flat` | The hand wobbled the other way; it arrived across its own path and skipped. |
| `too_slow` | Nothing left in it to bury the point. |
| `handle_low` | It went in, but too flat to get your fingers under the handle. |

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
3. **Territories stay convex.** (Checked after every turn of a long run of seeded random throws, alongside 1 and 2.) Wedges of a disc are convex, and a chord cut of a
   convex shape yields two convex shapes. Several bits of geometry rely on this —
   notably that a piece lies wholly on one side of the cut line, which is what
   makes the side-of-line test exact rather than approximate.
4. **Resolving a throw is pure and deterministic.** Same board plus same throw
   always yields the same result, on any machine. Required for an authoritative
   server and a client to agree without replaying each other's floating point.

## Tunable constants

In `RuleSet` — kept out of the geometry so they can be balanced without touching
it. Values are in metres: the arena's radius is 10 m, a thrower is 1.75 m tall, and
every knife is the size of the real thing (the Thrower is 30 cm).

| Name | Default | Meaning |
| --- | --- | --- |
| `standRadius` | 0.6 | Smallest circle a player must be able to fit on their land to stay in the game. |
| `minSharedBorder` | 0.05 | Shortest stretch of border that counts as a real connection. Stops a claim resolving on a single touching corner. |
| `reach` | 5 | Furthest a knife may land from your own ground and still draw a line. |

Everything about the throw lives in one file:
[config.ts](packages/core/src/throw/config.ts). The sandbox exposes it as live
dials — press **Tune** — with the derived numbers shown above the sliders, and a
**Copy JSON** button to paste a tuned config back into the file.

| Group | Fields | What it decides |
| --- | --- | --- |
| `knife` | `bladeLength`, `handleLength`, `mass`, `balance`, `edgeWidth` | The object itself |
| `gesture` | `fullDraw`, `minDraw`, `minPushSpeed`, `fullWhip`, `maxAim`, `driftGain`, `minPitch`, `maxPitch` | How the hand's motion is read |
| `style` | `pitch`, `spinImpulse`, `startingBladeAngle`, `releaseHeight`, `minSpeed`, `maxSpeed`, `referenceMass`, `weightPenalty` | How the arm throws |
| `scatter` | `spin`, `power`, `startingBladeAngle`, `heading` | How much the hand wobbles (seeded) |
| `stick` | `baseMisalignment`, `minEntryAngle`, `minMomentum`, `soilResistance`, `grabClearance` | What the ground accepts, and what counts |
| `flight` | `gravity`, `sampleInterval` | The world |

Derived, and read through helpers so there is one definition of each:

- **natural tumble** = `spinImpulse / momentOfInertia`. Decides how many turns a
  throw makes, not whether it sticks.
- **reach factor** from mass — see the knife section.
- **stick window** scales with blade length.
- **bite depth** from mass, impact speed and edge width, capped at the blade.
- **grab angle** — the shallowest a knife can stand and still clear
  `grabClearance` under its handle, from how much of it is left above the ground.

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

- **How long the reach is.** 5 is a first guess, not a measured one. The
  shortest throw lands about three from your feet, so a reach much under that
  would make every throw from the border too long. And the draw still spans
  throws out to 14, most of which now land out of reach. If short throws feel
  too coarse to place, the power range is the next thing to tune.
- **Roll.** The knife currently tumbles strictly within its flight plane, so the
  cut always runs along the throw. Letting a player put a twist on it would free
  the line from the aim — more control, and a third thing to learn. Deliberately
  left out until the point-draw-push version has been played.
