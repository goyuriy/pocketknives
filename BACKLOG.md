# Pocket Knives — backlog of epics

Every epic is placed twice:

- **Pillar** — which part of the game it lives in.
  - **Core** — the throw and the main loop: aim, draw, push, flight, stick, cut, turn.
  - **Meta** — what sits around a match: knives, progression, unlocks, collection.
  - **Social** — other people: multiplayer, leaderboards, reactions, sharing.
- **AERM** — which business goal it moves. Most epics move more than one; the
  first letter listed is the main one.
  - **A — Acquisition**: brings new players in (clips, links, word of mouth).
  - **E — Engagement**: makes a session better and longer.
  - **R — Retention**: brings players back tomorrow and next month.
  - **M — Monetization**: earns money without making the game worse.

**Ground rule for M:** nothing sold changes where a knife lands. Knives differ
in physics, so a knife is a way to play, never a purchase that wins. Money buys
looks, convenience and support — not reach or forgiveness.

Status: ✅ done · 🔨 in progress · 📋 ready · 💡 idea · ⏸ parked

---

## Matrix

| | **Acquisition** — brings new players in | **Engagement** — makes a session better | **Retention** — brings players back | **Monetization** — earns without spoiling it |
| --- | --- | --- | --- | --- |
| **Core** — the throw and the match | Slow-motion release ✅ · Impact juice ✅ · Throw replay · Physics comedy · First three throws | Slow-motion release · Impact juice · Walking · Cut reveal · Reach rule ✅ · Match flow · Bots · Physics comedy · Grounds · Wind | Match flow · First three throws · Bots · Grounds | Nothing, on purpose — the throw is never for sale |
| **Meta** — what you carry between matches | Daily board | Knife collection · Progression tree · Knife mastery | Knife collection · Progression tree · Daily board · Knife mastery · Season pass | Cosmetics · Season pass · Character & hands |
| **Social** — playing with other people | Link rooms · Reactions · Clip share · Party mode | Link rooms · Reactions · Party mode · Tournaments | Leaderboards · Friends & rivals · Crews · Tournaments | Supporter pack |

---

## Core — the throw and the main loop

### Slow-motion release — ✅ first pass · E, A
The knife leaves the hand at a crawl, then ramps up to cruising speed; the arm
follows through on the same slowed clock. This is the "clip moment" — the
second a player replays in their head and shares.
- ✅ Hand-off beat: the arm swings through to the release pose with the knife
  in the fist, so it is seen to leave the hand.
- ✅ Slow start, ramp to cruise; one pure timeline shared by state and stage.
- 📋 Slow the moment of impact too (bookend the flight), when the stick is close.
- 📋 Camera punch-in during the slow part (narrow the field of view a touch).
- 📋 Sound: a whoosh pitched down in slow motion, a thunk on impact.
- 💡 "Near miss" slow motion: extra slow when the knife lands at the edge of
  the stick window.

### Impact juice — ✅ first pass · E, A
The throw pays off on contact. Cheap, and what separates "a simulation" from
"a game". Everything is scaled by the impact's momentum, so a greatsword lands
harder than a needle.
- ✅ Impact beat: the camera holds at eye level for 0.3 s after the hit before
  lifting to show the cut, so the impact is seen where it happens.
- ✅ Dust burst, sprayed forward along the throw, seeded per throw.
- ✅ Quiver: the stuck handle waggles about the buried point and dies away —
  more after a scrappy stick, less after a clean one.
- ✅ Bounce: a knife that did not stick cartwheels in two hops to rest.
- ✅ Sound, synthesised (no assets): thunk + dirt crunch + ringing blade for a
  stick, skitters per bounce for a clatter, a dull knock for a drop.
- ✅ Screen shake, a short jolt.
- ✅ Weight reads first: dust and shake are driven by the knife's weight (on a
  log scale across the rack), with pace only shading them — a needle ticks the
  view and scuffs the dirt, a greatsword slams it and throws up clods.
- 📋 A puff of dust at each bounce, not just the first hit.
- 📋 A dark scuff mark left on the ground where a knife bounced.
- 💡 Hit-stop: freeze the frame for ~60 ms on a big stick.

### Cut reveal — 📋 · E
Land changing hands is the payoff and should be felt: the cut tears along the
ground, the taken piece lifts and flips to the thrower's colour, a score pop
shows the percentage.

### Throw replay — 💡 · A, E
The best throw of a match (biggest cut, longest stick, elimination) replayed
from a cinematic angle at the end. Throws are deterministic, so a replay is
five numbers and a seed — no video to store. Feeds **Clip share**.

### Walking — ✅ first pass · E
Walk your own ground and throw from wherever you stand on it, with basic
physics: a character capsule (Havok) that stands, falls and bumps into things,
knives that stay where they fell — stuck ones solid, missed ones bouncing to
rest for real. Controls follow proven patterns: mouse-look with a captured
pointer and WASD/arrows on desktop, a floating left-thumb stick on touch, the
left stick on a gamepad.
- ✅ Walk within your own land, sliding along its border.
- ✅ Mouse-look (Pointer Lock), angle from looking up and down.
- ✅ Look from 70° down to the sky with the mouse or gamepad; the throw goes
  where you look, up to a 45° lob, and straight down when looking all the way
  down. A gentler mouse draw (half a window for a
  full draw). Only the arms from your own eyes, elbows included.
- 📋 A sky: looking up shows black.
- 📋 In first person, hide the free hand while it hangs at the side — looking
  straight down it shows as a forearm cut off at the elbow.
- ✅ Turn all the way round without Pointer Lock: Q / E, or hold the cursor at
  the edge of the screen. A browser that refuses to capture the mouse drops to
  the free cursor instead of swallowing every click.
- ✅ Floating touch stick; gamepad left stick.
- ✅ Knives stay on the ground; stuck ones are solid, missed ones are physics.
- ✅ Gamepad aiming and throwing: right stick looks; with the right trigger
  held it swings (pull back, push through), as golf games do.
- 💡 Rumble on the draw and on impact, scaled like the camera shake.
- 📋 Footsteps and a little head bob, so walking is felt.
- 💡 A run-up: a few quick steps into the throw for extra reach.
- ✅ The throw moves like the basic overhand throw as taught: knife standing up
  out of a hammer grip, drawn up beside the head, over the top, followed
  through down at the ground.
- 📋 The rest of the body in the throw: step onto the front foot, lean into
  it, the free arm swinging back — today the rigged character's trunk and
  legs play their idle clip through the throw.

### Reach rule — ✅ first pass · E
From the yard game: you must reach the knife while keeping a foot on your own
land, which caps how deep one throw can claim. Makes deep throws a decision
instead of always the best move. See RULES.md, *Within reach*.
- ✅ A knife claims only if it lands within `reach` (5) of your own ground;
  otherwise `out_of_reach`, no line.
- ✅ The edge of your reach chalked on the ground as a dotted line in your
  colour, with a debug switch to hide it.
- 📋 Tune the reach against play, and the draw's power range with it: most of
  a full draw now lands out of reach.
- 💡 Per-player reach, for the **Long hands** skill (**Progression tree**).
- ✅ Throws go down into the ground: from straight down at your feet to a 45°
  lob, resting at 43° down, and the view looks down with the throw — the yard
  game is played at the dirt under your knees.
- 💡 Make steep throws miss sometimes — today straight down always sticks.

### Match flow — 📋 · E, R
A complete match: turn order shown, elimination moment, winner screen,
one-tap rematch. The sandbox becomes a game.

### First three throws — 📋 · A, R
Teach point, draw and push inside the first minute, by playing: throw one
onto open ground, throw two at a neighbour, throw three takes land. No text
walls. The biggest lever on day-one retention.

### Bots — 💡 · E, R
Opponents for solo play at three levels. A bot is just a choice of intent
(aim, pitch, draw) plus a drift; the core does the rest, so bots play by the
same physics as people.

### Physics comedy — 💡 · E, A
The RV-There-Yet vibe: Havok for things that don't decide the game. Failed
knives cartwheel and bounce, an eliminated player's character ragdolls off the
circle, a knife occasionally pings off another knife already in the ground.
Rule: cosmetic physics never decides who owns land.

### Grounds — 💡 · E, R
Arenas with different soil: sand (soft, deep bites, short skids), frozen
ground (hard, needs pace), mud (forgiving but slow). Soil already lives in the
config, so each ground is a tuning plus a look.

### Wind — 💡 · E
A per-round crosswind shown by grass and a flag, pushing lobs more than flat
throws. Makes the angle choice matter even more.

---

## Meta — around the match

### Knife collection — 📋 · E, R
The five knives exist; make choosing one a moment. A rack to pick from,
each knife's reach and forgiveness shown as it was measured (see RULES.md).
Which knives are open, and when, is decided by the knife branch of the
**Progression tree**.

### Progression tree — 💡 · R, E
What a player unlocks over time: five branches side by side — **grips**,
**throws**, **knives**, **skills**, **looks**. Designed in [docs/progression-tree.md](docs/progression-tree.md).
Rules: knives and grips are sidegrades while the character grows slightly with
experience, unlock by doing (trials) not by grinding, real throwing first,
nothing sold changes where a knife lands.
- 💡 **Grips** — how the knife is held, each a real throwing technique with its
  own trade-off, unlocked by a trial that practises it:
  - Hammer (start) — the baseline throw.
  - Blade grip (half-spin) — forgives short throws, loses reach.
  - Pinch — steadier hand and straighter push, a little less power.
  - Two-handed — heavy knives only; halves the weight penalty on reach.
  - No-spin — the knife barely turns: most reach, flattest flight, least stable.
    The mastery grip.
- 💡 **Knives** — the five that exist, met in order: Thrower, Kitchen, Cleaver,
  Needle; the Greatsword much later (character level 30, then a trial). It is
  in the rack now but locked, since two-handed throwing is parked: see
  **Character & hands**.
- 💡 **Throws** — the arm's path, separate from the grip:
  - Overhand (start) — the hand comes over from behind the shoulder, as today.
  - Underhand — the hand swings up from below and lets go with heavy reverse
    spin; the knife flips back over itself on its way in.
- 💡 **Grip mastery** — three ranks per grip, for sticks thrown with it; looks
  only.
- 💡 **Character level** — experience from sticks, claims and wins fills it;
  every level buys a look, levels 3, 6, 10, 15 and 20 each give a skill point.
- 💡 **Skills** — passive, always on, five levels each, raised with skill points:
  - Long hands (1–5) — reach further from your ground to draw the line. Each
    level adds a little more than the last: +2%, +3%, +4%, +5%, +6% of the base
    reach, so +20% at level 5. The character getting slightly better over time,
    on purpose; small, visible (the reach line shows it), never sold.
- 💡 **Looks** — experience levels unlock cosmetics; the branch the **Season pass** extends.

### Daily board — 💡 · R, A
One fixed starting board, stand and wind per day, same for everyone —
deterministic, so fair. Share the result as a small emoji grid, Wordle-style.
Feeds **Leaderboards**.

### Knife mastery — 💡 · R, E
Per-knife stats: sticks, best cut, longest throw. A reason to learn one knife
deeply.

### Cosmetics — 💡 · M
Blade finishes, handle wraps, trails, stuck-in-the-ground flourishes. Same
physics, different look — the first thing to sell.

### Season pass — 💡 · M, R
Free and paid tracks of cosmetics over a season of play. Only once **Progression tree** and **Cosmetics**
exist.

### Character & hands — 🔨 · M, E
Replace the primitive body with a rigged character (KayKit Barbarian was
shortlisted: CC0, chunky, big hands). The `BodyView` contract is ready for it.
Later: sleeves, gloves, tattoos as cosmetics.
- ✅ A whole body from primitives: chest in the player's colour, hips, head
  with hair and a nose, legs solved hip to ankle, shoes. The feet stand in a
  thrower's stance, walk in stride the way the body moves, and the chest
  leans into the throw.
- ✅ One character in every view, the thrower's own eyes included: seen from
  inside, its head is folded away to nothing (the usual first-person trick),
  so the hands, the grip and the free arm pointing are the same ones every
  other camera sees. The drawn body is only a stand-in until it loads.
- ✅ Debug cameras: `behind`, `side`, `front`, `hand` (close on the throwing
  hand), `top` and `arena`, besides the game's own `eyes`. Picked in the debug
  row or with `?camera=side` in the address; they hold still through a throw.
  `pnpm --filter @pocketknives/web shots` screenshots every one of them from
  a running preview (options in `apps/web/scripts/shots.mjs`).
- ✅ Real-world sizes: the world is in metres, the thrower 1.75 m, the knives
  their real length (the Thrower 30 cm) with life-size hands to hold them;
  the physics constants that depend on size were scaled with them, so throws
  land as before (the Thrower's identically; the others within a few throws
  in 3,000, from rounding their lengths to the millimetre). The Greatsword is
  scaled the same way for now, to 55 cm: its real length waits on two-handed
  throwing.
- ✅ A rigged character from Mixamo — X Bot, with Mixamo's idle, walk and
  run — for every camera but the thrower's own eyes. The clips are blended by
  pace and played at the speed the feet are really moving, backwards for
  walking backwards; the arms are turned each frame to reach where the drawn
  arms would, so the knife is in its hand. Loaded after the first frame; the
  drawn body stands in until it arrives. How to swap in other Mixamo exports:
  `apps/web/public/characters/README.md`.
- 📋 Strafing clips (Mixamo "Left/Right Strafe Walk"): a sidestep still plays
  the walk forward.
- ✅ The hand closes on the handle: turned so the fingers run across it and
  the thumb is on the blade side (a hammer grip), fingers curled round, the
  grip seated in the palm. Hands drawn twice life size, like the drawn fists,
  since a life-size hand cannot close round the game's chunky handles. Two
  hands on a sword sit side by side, the grip brought in until both reach.
- 📋 A throw clip for the body (the arms stay on the reach).
- ⏸ Two-handed throwing, parked for later. What exists: both hands on the
  sword's handle, side by side. Still to do: a two-handed throw of its own
  (overhead, both arms), the sword at its full real length and retuned for it,
  the Two-handed grip. The Greatsword stays locked in the rack until then.
- 📋 The rig's arms are shorter than the drawn ones, so from behind the knife
  jumps a little forward as it leaves the hand.

---

## Social — other people

### Link rooms — 📋 · A, E
Create a match, send a link, friends join in the browser with no install. The
core is deterministic, so a small authoritative server (Colyseus) checks each
throw from its intent and seed. The main acquisition loop for a web game.

### Leaderboards — 💡 · R
Scores on the **Daily board**, weekly biggest cut, longest stick, per knife.

### Reactions — 💡 · E, A
Taunts and emotes while someone else is throwing: a groan when a knife lands
handle-first, applause for a big cut. Social pressure is half the yard game.

### Clip share — 💡 · A
One tap exports the **Slow-motion release** and the cut, from a **Throw replay**, as a short video or
GIF with the game's link. Every share is an ad.

### Party mode — 💡 · A, E
Pass-and-play on one device (today's hotseat, polished) and a shared-screen
mode where phones are the controllers.

### Friends & rivals — 💡 · R
Recent opponents, rematch history, a running head-to-head score.

### Crews — 💡 · R
Small groups with a shared weekly score. Only after **Link rooms** and **Leaderboards** have players.

### Tournaments — 💡 · R, E
Weekend brackets on a fixed ground and knife rule set.

### Supporter pack — 💡 · M
The Steam build (Electron) as a paid premium or supporter pack: all cosmetics
of a season, a name colour, no power.

---

## Next up, in order

1. The rest of **Slow-motion release** (impact slow motion, whoosh) — finish the feel of one throw.
2. **Match flow** and **First three throws** — a playable game for a stranger.
3. **Link rooms** — the first way anyone else sees it.
