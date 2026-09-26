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

Status: ✅ done · 🔨 in progress · 📋 ready · 💡 idea

---

## Matrix

|            | **Acquisition** | **Engagement** | **Retention** | **Monetization** |
| ---------- | --------------- | -------------- | ------------- | ---------------- |
| **Core**   | C1 Slow-motion release ✅ · C2 Impact juice ✅ · C4 Throw replay · C9 Physics comedy · C7 First three throws | C1 · C2 · C3 Cut reveal · C5 Reach rule · C6 Match flow · C8 Bots · C9 · C10 Grounds · C11 Wind | C6 · C7 · C8 · C10 | — |
| **Meta**   | M3 Daily board | M1 Knife collection · M4 Mastery | M1 · M2 Progression · M3 · M4 · M6 Season pass | M5 Cosmetics · M6 · M7 Character & hands |
| **Social** | S1 Link rooms · S3 Reactions · S4 Clip share · S5 Party mode | S1 · S3 · S5 · S8 Tournaments | S2 Leaderboards · S6 Friends & rivals · S7 Crews · S8 | S9 Supporter pack |

---

## Core — the throw and the main loop

### C1 · Slow-motion release — ✅ first pass · E, A
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

### C2 · Impact juice — ✅ first pass · E, A
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
- 📋 A puff of dust at each bounce, not just the first hit.
- 📋 A dark scuff mark left on the ground where a knife bounced.
- 💡 Hit-stop: freeze the frame for ~60 ms on a big stick.

### C3 · Cut reveal — 📋 · E
Land changing hands is the payoff and should be felt: the cut tears along the
ground, the taken piece lifts and flips to the thrower's colour, a score pop
shows the percentage.

### C4 · Throw replay — 💡 · A, E
The best throw of a match (biggest cut, longest stick, elimination) replayed
from a cinematic angle at the end. Throws are deterministic, so a replay is
five numbers and a seed — no video to store. Feeds S4.

### C5 · Reach rule — 💡 · E
From the yard game: you must reach the knife while keeping a foot on your own
land, which caps how deep one throw can claim. Currently open in RULES.md.
Makes deep throws a decision instead of always the best move.

### C6 · Match flow — 📋 · E, R
A complete match: turn order shown, elimination moment, winner screen,
one-tap rematch. The sandbox becomes a game.

### C7 · First three throws — 📋 · A, R
Teach point, draw and push inside the first minute, by playing: throw one
onto open ground, throw two at a neighbour, throw three takes land. No text
walls. The biggest lever on day-one retention.

### C8 · Bots — 💡 · E, R
Opponents for solo play at three levels. A bot is just a choice of intent
(aim, pitch, draw) plus a drift; the core does the rest, so bots play by the
same physics as people.

### C9 · Physics comedy — 💡 · E, A
The RV-There-Yet vibe: Havok for things that don't decide the game. Failed
knives cartwheel and bounce, an eliminated player's character ragdolls off the
circle, a knife occasionally pings off another knife already in the ground.
Rule: cosmetic physics never decides who owns land.

### C10 · Grounds — 💡 · E, R
Arenas with different soil: sand (soft, deep bites, short skids), frozen
ground (hard, needs pace), mud (forgiving but slow). Soil already lives in the
config, so each ground is a tuning plus a look.

### C11 · Wind — 💡 · E
A per-round crosswind shown by grass and a flag, pushing lobs more than flat
throws. Makes the angle choice matter even more.

---

## Meta — around the match

### M1 · Knife collection — 📋 · E, R
The five knives exist; make choosing one a moment. A rack to pick from,
each knife's reach and forgiveness shown as it was measured (see RULES.md),
new knives unlocked by playing.

### M2 · Progression — 💡 · R
Experience per match, levels, titles ("Yard Menace"). Unlocks knives and
cosmetics, never power.

### M3 · Daily board — 💡 · R, A
One fixed starting board, stand and wind per day, same for everyone —
deterministic, so fair. Share the result as a small emoji grid, Wordle-style.
Feeds S2.

### M4 · Knife mastery — 💡 · R, E
Per-knife stats: sticks, best cut, longest throw. A reason to learn one knife
deeply.

### M5 · Cosmetics — 💡 · M
Blade finishes, handle wraps, trails, stuck-in-the-ground flourishes. Same
physics, different look — the first thing to sell.

### M6 · Season pass — 💡 · M, R
Free and paid tracks of cosmetics over a season of play. Only once M2 and M5
exist.

### M7 · Character & hands — 💡 · M, E
Replace the primitive arms with a rigged character (KayKit Barbarian was
shortlisted: CC0, chunky, big hands). The `BodyView` contract is ready for it.
Later: sleeves, gloves, tattoos as cosmetics.

---

## Social — other people

### S1 · Link rooms — 📋 · A, E
Create a match, send a link, friends join in the browser with no install. The
core is deterministic, so a small authoritative server (Colyseus) checks each
throw from its intent and seed. The main acquisition loop for a web game.

### S2 · Leaderboards — 💡 · R
Daily-board scores (M3), weekly biggest cut, longest stick, per knife.

### S3 · Reactions — 💡 · E, A
Taunts and emotes while someone else is throwing: a groan when a knife lands
handle-first, applause for a big cut. Social pressure is half the yard game.

### S4 · Clip share — 💡 · A
One tap exports the slow-motion release and cut (C1, C4) as a short video or
GIF with the game's link. Every share is an ad.

### S5 · Party mode — 💡 · A, E
Pass-and-play on one device (today's hotseat, polished) and a shared-screen
mode where phones are the controllers.

### S6 · Friends & rivals — 💡 · R
Recent opponents, rematch history, a running head-to-head score.

### S7 · Crews — 💡 · R
Small groups with a shared weekly score. Only after S1 and S2 have players.

### S8 · Tournaments — 💡 · R, E
Weekend brackets on a fixed ground and knife rule set.

### S9 · Supporter pack — 💡 · M
The Steam build (Electron) as a paid premium or supporter pack: all cosmetics
of a season, a name colour, no power.

---

## Next up, in order

1. The rest of **C1** (impact slow motion, whoosh) — finish the feel of one throw.
2. **C6 Match flow** and **C7 First three throws** — a playable game for a stranger.
3. **S1 Link rooms** — the first way anyone else sees it.
