# The fight crash

The tab dies. Not an exception, not an out-of-memory message — the renderer
process is gone, and nothing is written anywhere. This is what was done to find
it, so that whoever picks it up next does not repeat any of it.

## How to reproduce

Serve the folder and open it. `sim.speed = 6`, leave it alone. With fights on
it dies inside 30–50 seconds, reliably: five trials in a row, 33s, 35s, 38s,
43s, 48s. It needs no rides, no stalls and no paths — a brand new park with
a dozen visitors wandering about is enough.

## The one clean result

Fights are a necessary condition, and the evidence for that is the only clean
signal in the whole investigation.

| what was running | trials | crashed |
| --- | --- | --- |
| `sim.maybeFight` stubbed out | 6 | **0** |
| everything else tried | 30+ | most |

Six trials with fights off ran about 2,500 seconds of park time between them
without a single death.

## Narrowed to one statement

`maybeFight` was rebuilt a piece at a time, each level doing everything the
levels below it do:

| level | body | crashed |
| --- | --- | --- |
| L1 | the whole search — filter, pick, find a pair, check for a guard, check for torchlight — and then **change nothing** | **0/3** |
| L2 | L1 **plus `a.fightT = b.fightT = 3.5`** | **2/2** |
| L3 | L2 plus `state = 'fight'` | 1/2 |
| L4 | L3 plus the health damage | 1/2 |
| L5 | L4 plus the anger glyph | 0/2 |
| L6 | L5 plus the sound, the counter and the toast | 2/2 |
| L7 | the real thing, with the bystander shock | 2/2 |

L1 found a pair worth fighting 21 to 25 times per trial and survived all three.
Add one assignment and it dies. Everything above L2 is noise around a crash
that is already happening.

## What has been ruled out

Each of these was tested, not assumed.

- **A leak.** A census of every array, Map and Set reachable from the game,
  sampled every three seconds to the moment of death: all bounded. The JS heap
  sat flat at 4–5 MB throughout. The sprite cache topped out at 99 entries, the
  glyph cache at 6.
- **The machine running out of memory.** No cgroup limit, 15 GB free,
  `memory.oom_control` reports `oom_kill 0`, and `dmesg` is empty. The renderer
  is killing itself, not being killed.
- **Drawing.** With `renderer.draw` stubbed out entirely it still died 2/3;
  with `renderer.drawPerson` stubbed — so the anger glyph is never drawn — 3/3.
- **The graphics backend.** Default, `--disable-gpu`,
  `--disable-accelerated-2d-canvas` and software GL: all four die.
- **A canvas state-stack leak.** `save()` and `restore()` balance in every
  drawing file, and no `return` sits between a `save()` and its `restore()`.
- **One enormous allocation.** Canvas dimensions, `createImageData`,
  `getImageData`, `drawImage` arguments, gradients, arcs, rects, `new Array`
  and `ArrayBuffer` were all wrapped and checked for a silly value. Nothing
  tripped. (That run also survived, which is its own finding — see below.)
- **The freeze.** A fight used to hold the pair still for 3.5 seconds. Holding
  them for a single frame instead: still 2/3.
- **Stale state.** Making a fight release the queue slot and bench and clear
  the path and target: 5/5.
- **Removing the freeze altogether**, so a fight is a mood event and the pair
  walk on: 3/5. Better, not a fix — and kept anyway, because a frozen visitor
  cannot be served, cannot spend, cannot leave and cannot cheer up.

## The awkward part

It is timing-sensitive. Wrapping the hot canvas methods to check their
arguments added enough overhead that the page survived 60 seconds and 12
fights with nothing tripping any of the checks. Slowing the renderer down
prevents it. That is why every result above is quoted as a fraction rather
than a yes or a no, and why no single trial should be read as a pass.

So: the trigger is one assignment, and every mechanism that assignment could
work through has been tested and cleared. Whatever is left is inside Chromium
where the page cannot see it.

## What ships

Fights are off by default, with a switch in the Menu that says so and why.
Everything else about them is untouched: the threshold, the cooldown, the
guard who prevents them, the damping on the feedback spiral. Turn them on and
the park behaves exactly as it always did, including this.

## If you pick this up

Things not yet tried, roughly in order of what they would tell you:

1. Whether it happens at 1× speed, or only when the clock is wound forward.
   Everything above was run at 6×.
2. A Chromium build with logging that actually reaches stderr from a headless
   renderer in a container — `--enable-logging=stderr --v=1` and `dumpio` both
   produced nothing here.
3. A different Chromium version, and a non-Chromium browser. Everything above
   is one build: `chromium-1194`.
4. `chrome://crash` style minidumps with `--enable-crash-reporter` and a
   writable `--crash-dumps-dir`.
