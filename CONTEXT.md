# Project Context — The Ridgeback Cup (SOFE 4850U, Group 6)

Single source of truth for the project: what we're building, who owns what, and the decisions already made.
Read this before starting work. If a decision changes, update this file in the same commit.

- **Course:** SOFE 4850U User Experience Design, Fall 2026, Ontario Tech University
- **Group 6:** Salum Khatib, Viet Nguyen Bao, Sufyan Mohammed
- **Presentation and demo:** **Fri Nov 20, 2026**
- **Final report + source zip:** Fri Dec 4, 2026, 11:59 pm (Canvas)
- **Shared plan doc (roles, rubric, deliverables):** https://claude.ai/artifact/TKKs3pCuSn5t2bT1QtwmxE

---

## 1. What we're building (from the proposal)

A mobile-first website for a fictional café, **The Ridgeback Cup**. An animated barista avatar, **Hunter**,
takes a **pickup coffee order** through **voice or typed text**. Hunter greets the user, asks only for what it
still needs, and confirms the full order before submitting it.

The focus is the **conversation experience, not complex AI**. At every point the user should know:
- what Hunter heard,
- what has been recorded so far,
- how to fix a mistake without starting over.

### Target users and goal
- **Primary users:** university students and commuters ordering ahead between classes or before a train.
  They're short on time and often multitasking. Some prefer speaking; others are in a quiet library and need to type.
- **User goal:** place a correct pickup order in **under two minutes**, without browsing a full menu and
  without re-entering information after a mistake.

### What Hunter collects (the 8 "slots")
drink, size, hot/iced, milk, extras, quantity, pickup time, first name for the cup.
Payment is **pay at pickup** only, so no card details are ever requested.

### Required error and recovery cases (from the proposal)
- **Several details at once:** "a large iced oat latte" fills four slots in one turn.
- **Missing details:** "a latte" means Hunter asks only for what's missing, starting with size.
- **Unsupported items:** for an item not on the menu, Hunter lists the closest available options.
- **Corrections:** "actually, make it almond milk" updates one slot without restarting.
- **Misheard speech:** the user can retry or switch to typing.

### Avatar and interface
- Hunter is a friendly illustrated barista with **4 visible states: idle, listening, thinking, speaking**.
  Each state is shown by animation **and** a text label. Every spoken reply also appears as text.
- The phone screen has three parts:
  - **Conversation panel:** Hunter, the chat transcript, an **"I heard: …"** line after each voice input,
    and **quick-reply buttons** (e.g. Small / Medium / Large) so the task can be done without speaking.
  - **Live order ticket:** a bottom sheet that fills in as the user answers. Any field can be tapped to
    change it, and it shows exactly what information is being collected.
  - **Controls:** a large mic button within thumb reach, a text box, Repeat, Back, Start over, Mute voice.

### Platform and tech
- **Target:** mobile phones, tested in **Chrome on Android**.
- **Stack:** React + Vite + TypeScript. Hunter's states use simple CSS animations.
- **Voice:** the browser's Web Speech API (speech-to-text and text-to-speech). It's unreliable in Safari
  on iPhone, so typing is always a full alternative.
- **Conversation logic:** a rule-based state machine with keyword matching against a fixed menu, so a single
  answer can fill several slots. Anything that doesn't match a menu item makes Hunter list the closest options.
- **Deploy:** static site on **Vercel** (HTTPS is required for speech recognition; testers get a link).
- **Design artifacts:** Figma.

---

## 2. Roles

The split follows the app's natural boundaries so everyone can work in parallel.

```
Typed input ──────────────┐
                          ├─► UserEvent ─► ENGINE handle(event) ─► EngineOutput ─┬─► chat + ticket + buttons
Speech-to-text (string) ──┘                    (Role 1)                         ├─► text-to-speech
                                                                                └─► Hunter's state
```

The engine never knows whether input was typed or spoken. Speech-to-text produces a plain string that goes
down the same path as typed text.

### Role 1 — Conversation Engine (Sufyan)
Plain TypeScript in `src/engine/`, no React. Testable without a UI.
- **Menu data** (`menu.ts`): every valid value plus its keywords/synonyms and per-drink rules.
- **Matcher:** normalize text (lowercase, strip punctuation, number words to digits); scan for keywords from
  **every** slot; tell an unknown item apart from "nothing understood"; recognize yes/no and corrections;
  cope with messy speech-to-text output.
- **State machine:** phases `collecting` → `confirming` → `done`; ask for the next empty slot; handle
  `edit` / `back` (history snapshots) / `restart`; corrections change one slot without restarting.
- **Replies + quick replies** for every state.
- **Conversation flowchart** (graded deliverable; the spec for the engine).
- **Done when:** all 6 required test cases pass by feeding strings in, with no UI.

### Role 2 — Interface & Voice (Salum)
React components in `src/components/`.
- Mobile-first layout: Hunter + status label, chat transcript with "I heard: …", quick replies,
  order-ticket bottom sheet, bottom control bar.
- App wiring: hold engine state, call the engine on every action, render and speak the output.
  **Build against a fake engine** returning canned `EngineOutput`s until the real one is merged.
- Speech-to-text: interim results; on low confidence show **Retry** and **Type instead**; friendly
  fallbacks for no-speech, mic-permission-denied and network errors.
- Text-to-speech: Hunter is `speaking` while audio plays; **Mute** stops it; **Repeat** re-speaks.
- Order ticket: tapping a field sends an `edit` event; **briefly highlight the field that just changed**.
- Deploy to Vercel.
- **Done when:** a full order works by typing and by voice on an Android phone from the Vercel link.

### Role 3 — UX Research, Avatar, Testing & Presentation (Viet)
- Persona, user journey, wireframes in Figma (wireframes first, since Role 2 builds from them).
- **Hunter component:** `<Hunter state="idle" | "listening" | "thinking" | "speaking" />`, an SVG
  with a CSS animation and a text label per state; respects `prefers-reduced-motion`.
- Usability testing with 3+ users covering the 6 test cases; record completion, time, errors, quotes,
  confusion; rank problems; note the fixes made.
- Run the 6 test cases on the deployed build daily from Wednesday and report bugs.
- Slides, a **backup demo video** (in case live voice fails), and the lead on the final report.

### Deliverable ownership
| # | Deliverable | Owner | Support | Due |
|---|---|---|---|---|
| 1 | Project proposal | All | – | Done (Oct 11) |
| 2 | User persona | Role 3 | – | ASAP |
| 3 | User journey / task flow | Role 3 | Role 1 checks it against the flowchart | ASAP |
| 4 | Conversation flowchart | Role 1 | Role 3 redraws it in Figma for the slides and report | Wed Nov 18 |
| 5 | Wireframes | Role 3 | Role 2 reviews | ASAP |
| 6 | Working prototype | Role 1 (engine) + Role 2 (UI) | Role 3 (Hunter component) | Wed Nov 18 |
| 7 | Voice interaction demo | Role 2 | Role 1 (matcher handles speech-to-text output) | Thu Nov 19 |
| 8 | Usability testing (3+ users) | Role 3 | Roles 1 and 2 fix the issues found | Thu Nov 19 |
| 9 | Final UX report (5 pages max) | Role 3 (lead) | Role 1: conversation design and engine; Role 2: UI and voice | Fri Dec 4, 11:59 pm |
| 10 | Presentation and demo (5–10 min) | Role 3 (slides, backup video) | Everyone presents their own part | Fri Nov 20 |
| – | Canvas zip: documented source | Role 1 + Role 2 | Role 3 adds the report PDF | Fri Dec 4, 11:59 pm |

---

## 3. Shared contract (`src/engine/types.ts`)

This is the **only** thing the engine and the UI share. Don't change it without telling the group.

```ts
export type Slot = 'drink' | 'size' | 'temp' | 'milk' | 'extras' | 'quantity' | 'pickup' | 'name';

export type Order = Partial<{
  drink: string; size: string; temp: 'hot' | 'iced'; milk: string;
  extras: string[]; quantity: number; pickup: string; name: string;
}>;

export type UserEvent =
  | { kind: 'text'; text: string }   // typed or speech-to-text output, same path
  | { kind: 'edit'; slot: Slot }     // tapped a ticket field
  | { kind: 'back' }
  | { kind: 'restart' };

export type EngineOutput = {
  reply: string;                     // shown as text and spoken
  order: Order;                      // drives the ticket
  quickReplies: string[];            // e.g. ["Small", "Medium", "Large"]
  phase: 'collecting' | 'confirming' | 'done';
};
```

---

## 4. Final menu (decided Wed Nov 18)

Each drink's rules decide which questions Hunter asks. A question that doesn't apply is **skipped**.

| Drink | Hot / iced | Milk | Extras |
|---|---|---|---|
| Coffee | Both | **Optional:** Oat, Almond, Whole, No milk | Yes |
| Latte | Both | **Required:** Oat, Almond, Whole | Yes |
| Matcha latte | Both | **Required:** Oat, Almond, Whole | Yes |
| Hot chocolate | **Hot only** (temperature not asked) | **Not asked** | Yes |
| Ridgeback Roast *(signature: dark roast + extra espresso shot + maple syrup)* | Both | **Optional:** Oat, Almond, Whole, No milk | Yes |

- **Sizes (all drinks):** Small, Medium, Large
- **Extras (any number, or none):** Extra espresso shot, Vanilla syrup, Caramel syrup, Whipped cream
- **Pickup time:** ASAP, In 15 minutes, In 30 minutes
- **Name:** typed (speech recognition handles names poorly)
- **Payment:** pay at pickup

Three milk states:
- **Required:** ask which milk; "no milk" isn't offered.
- **Optional:** ask which milk, with "No milk" as a fourth option (one question, not two).
- **Not asked:** skip the question.

Known matcher edge cases:
- "matcha latte" contains "latte": the matcher must pick matcha latte, not latte.
- "Ridgeback" may be transcribed as "ridge back": accept both. Aliases like "special" / "signature" also work.

---

## 5. Conversation design decisions

- **One drink type per order.** Quantity covers "2 lattes". No multi-item cart, no food.
- **Ask order:** drink → size → temperature → milk → extras → quantity → pickup time → name → confirm.
  Drink comes first because it decides which other options are valid.
- **One question per turn, but one answer can fill several slots.**
- **Greeting** says what Hunter can do and leads straight into the first question.
- **Short echo:** Hunter repeats only the new value, folded into the next question
  ("Medium, got it. Hot or iced?"). The live ticket covers people looking at the screen; the echo covers
  people only listening.
- **Confirm step reads back everything** before the user says yes: quantity, size, temperature, drink, milk,
  extras, pickup time, name.
- **Pay at pickup** is stated so users aren't left wondering.
- **Conflicts with drink rules** (e.g. "iced hot chocolate", "black latte"): Hunter explains what's
  available instead of silently accepting or ignoring it.

---

## 6. Minimum test cases (from the handout)

| Test case | Expected behaviour |
|---|---|
| Normal completion | Valid answers, task completed |
| Missing information | Incomplete answer → Hunter asks for the missing detail |
| Invalid answer | Unsupported item → Hunter explains the available choices |
| Correction | User changes an earlier answer → updated without restarting |
| Voice recognition problem | Wrong or unclear transcript → user can retry or type |
| Final confirmation | Hunter summarizes everything and asks for confirmation |

---

## 7. Timeline (revised Wed Nov 18)

1. **Wed Nov 18:** flowchart + `menu.ts` + engine (Role 1). Persona, journey, wireframes, Hunter (Role 3).
   UI against a fake engine (Role 2). **Tonight:** merge the engine into the UI with a full order working by text.
2. **Thu Nov 19:** voice working, deployed to Vercel, 3 usability tests, quick fixes, slides, backup video, rehearsal.
3. **Fri Nov 20:** presentation and demo.
4. **By Fri Dec 4, 11:59 pm:** final report, documented source zip, peer review survey.

---

## 8. Working in the repo

```
src/
  engine/       ← Role 1: types.ts, menu.ts, matcher.ts, engine.ts
  components/   ← Role 2 UI + Role 3's Hunter
  App.tsx
  main.tsx
docs/           ← flowchart and other design notes
```

- `git pull` before you start each session; commit small and often.
- Stay in your own folder to avoid merge conflicts. Coordinate in the group chat before editing someone else's files.
- Run locally: `npm install` once, then `npm run dev` and open http://localhost:5173.

## 9. Out of scope / stretch goals

- **Stretch:** after confirming, "Want to order another drink?" starts a fresh order with the name and pickup
  time carried over.
- **Stretch:** Hunter describes the Ridgeback Roast when asked.
- **Out of scope (list under limitations in the report):** food, multi-drink orders, prep-time estimates,
  card payment, accounts.
