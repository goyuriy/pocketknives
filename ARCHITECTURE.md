# Pocket Knives — architecture

How the code is laid out, the few rules that keep it that way, and how the
backlog — link rooms first — plugs into it. [RULES.md](RULES.md) is what the
game *is*; this is how the code is built round it.

The short version: **the game is data, changed only by a pure function from
commands; everything on screen is derived from that data and the clock.** No
classes, no inheritance, no hidden state in the rules. Behaviour is functions,
state is plain objects, and the per-frame work is a list of small systems.

---

## The layers

```
 input devices ──► intents ──► Command ──► Session ──► applyCommand ──► GameState + GameEvents
 (mouse, touch,    (aim, draw,              (local or      (pure, core)            │
  pad, keys)        push, walk)              network)                               ▼
                                                                     useGame: playback + what to show
                                                                                    │
                                                         frameOf(snapshot, clock) ──┤ once a frame
                                                                                    ▼
                                                  systems: arena · knives · thrower · camera ──► Babylon views
```

| Layer | Where | What it is | May use |
| --- | --- | --- | --- |
| **Rules and physics** | `packages/core/src/{geometry,rules,throw}` | Pure maths: the cut, the flight, sticking, the knives. | Nothing but itself. |
| **Game** | `packages/core/src/game` | The match as data (`GameState`), what can be asked of it (`Command`), what it answers (`GameEvent`), and the one function that moves it on (`applyCommand`). | The rules. |
| **Session** | `apps/web/src/session` | The client's one line to the game: read the state, send commands, hear updates. Today a local authority; next, a networked one. | The game. |
| **Presentation state** | `apps/web/src/state`, `apps/web/src/playback` | What to show and when: a throw event becomes a playback, and the playback decides which board and whose turn are on screen. Plus this device's preferences (camera, reach line, slow motion). | Session, game types. |
| **Stage** | `apps/web/src/stage` | `frameOf` works out a frame's facts; systems pose the views. `math/` is pure and tested; `views/` and `systems/` are the only code that touches Babylon. | Presentation state. |
| **Input** | `apps/web/src/input`, `stage/use*Controls` | Pointer, touch, pad and keys turned into intents and walking. | — |
| **UI** | `apps/web/src/ui` | The HUD and debug panels, in React. | Presentation state. |

Dependencies point one way, down the table's first column: the core knows
nothing of React, Babylon or the browser, and a test fails if it starts to
(`apps/web/src/architecture.test.ts`).

---

## The rules

1. **The core is pure and deterministic.** No `Math.random`, no clocks, no
   DOM, no engine. Randomness arrives as a seed; time arrives as an argument.
   Same inputs, same outputs, on any machine. *Checked by a test.*
2. **State is plain data.** `GameState` is serialisable: no methods, no class
   instances, no references to anything on screen. It can be sent, stored,
   diffed and replayed.
3. **Only `applyCommand` changes the game.** Everything a player (or a bot, or
   a host) can do is a `Command`. The authority checks it — `not_your_turn`,
   `off_your_ground`, `knife_locked` — and either applies it or turns it down
   with a reason; the state never changes any other way.
4. **The authority owns the dice.** A throw command carries the stance and the
   hand's intent, never an outcome and never a seed. Whoever is the authority
   stamps the seed (`Stamp`), so no player chooses their own luck, and a throw
   can be verified from its record.
5. **Events say what happened; state says where things stand.** A `thrown`
   event carries the board the knife landed on, so any client — even one that
   only ever saw the state after — can show the cut arriving.
6. **The screen is derived, never stored.** What is on screen is a function of
   the state, the last events and the clock (`playbackPhase`, `shownBoard`,
   `frameOf`). No timer decides anything: drop a frame, reload, or join
   mid-throw, and the next frame is simply right.
7. **Per frame, systems over data.** The director builds one `Frame` of facts
   and runs the systems in order; each owns its views and hands on what the
   next needs. A system is two functions (`update`, `dispose`) — no base class.
8. **Cosmetic physics never decides anything.** Havok bounces failed knives
   and keeps the walker off standing ones; who owns land is decided only by
   the core.
9. **No classes anywhere.** Data is plain, behaviour is functions, and the
   few long-lived things (a view, a session) are closures. *Checked by a test.*

### Where does new code go?

| It… | Put it in |
| --- | --- |
| decides who owns land, whether a knife sticks, whose turn it is | `packages/core/src/rules` or `throw` — with a test |
| is something a player can ask for | a `Command` in `core/game/commands.ts`, handled in `applyCommand` |
| is something everyone should be told about | a `GameEvent` |
| is a number that shapes a throw | `ThrowConfig` (`core/throw/config.ts`), so it can be tuned and sent |
| is about pacing what is shown | `apps/web/src/playback` — pure, from events and the clock |
| is a new thing on screen | a view in `stage/views`, posed by a system in `stage/systems` |
| is maths for the screen | `stage/math` — pure, with a test |
| is this device's preference | `useGame`, remembered with `useRememberedFlag` / `useRememberedChoice` |

---

## How the backlog plugs in

- **Link rooms.** A server runs a room: it holds a `GameState`, receives
  commands over a socket, calls `applyCommand` with a seed it draws, and
  broadcasts the resulting events and state. On the client a `NetSession`
  implements the same `Session` shape, so nothing above it changes. A client
  that joins late gets the state and sees knives already lying where they
  fell. Walking and aiming — where a player stands and points *this instant* —
  never decide anything, so they go on a separate, lossy presence channel
  rather than through commands; only the stance a throw is thrown from is
  part of the command.
- **Party mode.** Hotseat is a local session with every player on one device —
  today's sandbox with the practice settings off. Phones as controllers are a
  network session where each phone sends one player's commands.
- **Bots.** A bot is a function from `GameState` to a `Command`: choose a
  stance and an intent, send it. It plays by the same physics because it goes
  through the same `applyCommand`.
- **Throw replay** and **Clip share.** A `ThrowRecord` holds the launch, the
  seed and the result; the flight is a closed-form arc the client redraws. A
  whole match replays from the first state and its stamped commands.
- **Daily board.** A `createGame` with a fixed seed and fixed ground, the same
  for everyone; scores compare because the core is deterministic.
- **Match flow.** Elimination and the winner are already events (`eliminated`,
  `won`); a rematch is the `newMatch` command.
- **Grounds, Wind.** Settings in `GameSettings.throw` — soil and air are
  numbers the flight already reads.
- **Progression** (knives by level, Long hands). Per-player data in
  `PlayerState` (`level`, `knifeId`); a skill that changes the rules, like a
  longer reach, becomes a per-player rule the core reads.

---

## Testing

- The core is tested as functions: rules, flight, sticking, and
  `applyCommand` (a replay test proves determinism).
- The web's pure parts — playback, frame, poses, strides, camera — are tested
  the same way, with no browser.
- The rigged character is tested headless on Babylon's `NullEngine`.
- The scene is checked by looking: `pnpm --filter @pocketknives/web shots`
  screenshots every debug camera (`--throw`, `--walk`, `--draw` for moments),
  and `window.pocketknives` gives a console or a script the session and a real
  throw.
