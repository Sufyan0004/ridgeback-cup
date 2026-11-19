# Required test cases: checklist

The 6 minimum test cases from the handout (section 11). Run them on the **deployed link** in
**Chrome on Android**, with media volume up. Use a fresh page (refresh) for each case.

- **Automated (engine):** `npm test` runs the engine side of every case. All should pass once the real engine is merged.
- **Manual (this page):** covers what only a person on a phone can check: voice, Hunter's states, the ticket.

Record each run: date, build/commit, device, pass/fail, and a note for anything odd.

## 1. Normal completion
| Step | Expected | Pass? |
|---|---|---|
| Open the link | Hunter greets you and says what he can do; drink buttons shown; "Ready to help" | |
| Order by **voice**: latte → medium → hot → oat → no extras → 1 → ASAP, then **type** your name | Each answer shows "I heard: …"; Hunter speaks every reply; ticket fills in (x/8) | |
| Read-back | Summary card lists all 8 details + "Pay at pickup" | |
| Tap **Confirm order** | "Order confirmed!" with pickup time; ticket is locked | |

## 2. Missing information
| Step | Expected | Pass? |
|---|---|---|
| Say "a latte" | Drink filled; Hunter asks only for size; Small / Medium / Large shown | |
| Say "a large iced oat latte" (fresh page) | Drink, size, temperature, milk all filled in one turn; Hunter asks about extras | |

## 3. Invalid answer
| Step | Expected | Pass? |
|---|---|---|
| Say "a cappuccino" | Not accepted; Hunter names what's available (closest match first) | |
| Say "iced hot chocolate" | Hunter explains hot chocolate is hot only; temperature set to Hot | |
| At "How many?", type "50" | Rejected; Hunter says the limit | |

## 4. Correction
| Step | Expected | Pass? |
|---|---|---|
| After milk = oat, tap **Milk** on the ticket, choose Almond | Only milk changes; the order continues from where it was | |
| Mid-order, say "actually, make it almond milk" | Milk updates without restarting; ticket row flashes green | |
| At the read-back, say "no, make it large" | Size updates; read-back shown again | |
| Tap **Back** | Last answer undone; that question asked again | |

## 5. Voice recognition problem
| Step | Expected | Pass? |
|---|---|---|
| Tap mic, mumble or say something off-topic | "I heard: …" shown; Hunter re-asks with the options as buttons | |
| Tap mic, stay silent | "I didn't hear anything" with **Retry voice** and **Type instead** | |
| After a voice answer, tap **Undo and try again** | Answer undone; mic starts listening again | |
| Tap **Type instead** | Keyboard opens on the text box | |
| Deny mic permission (site settings) and tap mic | "Microphone access is blocked…" with **Type instead** (no Retry) | |

## 6. Final confirmation
| Step | Expected | Pass? |
|---|---|---|
| Complete all 8 details | Hunter reads back every detail out loud and on screen; order not placed yet | |
| Tap **Edit order** | Ticket opens; tapping a field changes it | |
| Tap **Confirm order** | Order placed only now | |

## Also check every run
- Hunter's label matches what's happening: Listening… / Thinking… / Speaking… / Ready to help
- Tapping the mic while Hunter is talking stops him
- **Mute** stops speech; **Repeat** replays the last reply
- **Start over** with a half-filled order asks "Start over?" first
- The whole order can be done **without speaking** (buttons + typing only)
