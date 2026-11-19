# Conversation Flowchart — Hunter (The Ridgeback Cup)

How Hunter handles every user input, from the greeting to the confirmed order.
GitHub renders the diagram below automatically. Role 3 can redraw it in Figma for the slides and report.

## Main flow: every typed or spoken answer

```mermaid
flowchart TD
    Open([User opens the site]) --> Greet["Hunter greets:<br/>'Hello! Welcome to The Ridgeback Cup. I'm Hunter, your barista.<br/>I can take your pickup order, and you can speak or type.<br/>What would you like to drink?'"]
    Greet --> Input[/User speaks or types an answer/]
    Input --> Phase{Which phase?}

    Phase -- done --> AfterDone["'Your order is in!<br/>Tap Start over for a new order.'"]
    AfterDone --> Input

    Phase -- confirming --> ConfirmAns{Yes, or no?}
    ConfirmAns -- yes --> Placed(["'Your order is in! It will be ready ASAP.<br/>You can pay when you pick it up.'"])
    ConfirmAns -- "no, with a new value<br/>e.g. 'no, make it large'" --> Match
    ConfirmAns -- "no, nothing else" --> WhatChange["'No problem. What would you like to change?'<br/>+ slot buttons"]
    WhatChange --> Input
    Placed -.-> Another["Stretch goal: 'Want to order another drink?'<br/>new order, name + pickup carried over"]

    Phase -- collecting --> IsName{Is Hunter asking<br/>for the name?}
    IsName -- yes --> NameOK{1 to 20 characters?}
    NameOK -- yes --> Apply
    NameOK -- no --> Reask
    IsName -- no --> Match["Matcher scans the answer for values<br/>for ALL slots, not just the one asked"]

    Match --> Any{Found anything<br/>on the menu?}
    Any -- "no: misheard, silent,<br/>or off-topic" --> Misses{Second miss on<br/>this question?}
    Misses -- no --> Reask["'Sorry, I didn't catch that.'<br/>+ the same question + its options"]
    Misses -- yes --> Escalate["'I'm still having trouble.<br/>You can tap an option below or type your answer.'"]
    Reask --> Input
    Escalate --> Input

    Any -- yes --> Ambig{Two different values<br/>for one slot?}
    Ambig -- yes --> Clarify["'Did you want oat or almond?'"]
    Clarify --> Input
    Ambig -- no --> Unknown{Asked for a drink<br/>not on the menu?}
    Unknown -- yes --> Closest["'We don't have cappuccino, but our latte is the closest.<br/>We also have ...' + drink buttons<br/>(other valid answers are kept)"]
    Closest --> Input
    Unknown -- no --> Qty{Quantity outside 1 to 10?}
    Qty -- yes --> QtyMsg["'I can take up to 10 drinks per order.<br/>How many would you like?'"]
    QtyMsg --> Input
    Qty -- no --> Apply["Apply the answer:<br/>empty slot = fill it<br/>filled slot with a different value = correction"]

    Apply --> Rules["Check every answer against the drink's rules:<br/>keep valid ones, auto-set or drop invalid ones,<br/>and say what changed"]
    Rules --> Empty{Any required slot<br/>still empty?}
    Empty -- yes --> AskNext["Echo what was understood, then ask the next empty slot:<br/>drink, size, temp*, milk*, extras, quantity, pickup, name<br/>* skipped when the drink doesn't allow a choice"]
    AskNext --> Input
    Empty -- no --> Confirm["Read back everything:<br/>'One medium hot latte with almond milk, no extras,<br/>ready ASAP, for Sam. Is that right?'"]
    Confirm --> Input
```

## Control buttons (UI events, not speech)

```mermaid
flowchart LR
    Back[/Back button/] --> Undo["Restore the order to before the last answer"] --> ReaskLast["Re-ask that question"]
    Restart[/Start over/] --> Sure{Order nearly done?}
    Sure -- yes --> AreYouSure["'Are you sure? This clears your order.'"]
    Sure -- no --> Clear
    AreYouSure -- yes --> Clear["Clear everything"] --> Greet2["Greet again"]
    Tap[/Tap a ticket field/] --> AskField["Re-ask that field"] --> Resume["Then continue from where Hunter was"]
```

Repeat and Mute are handled entirely by the UI (they replay or silence the last reply) and never reach the engine.

## Drink rules used by "Check every answer against the drink's rules"

| Drink | Temperature question | Milk question |
|---|---|---|
| Coffee | Hot or iced | Oat, almond, whole, or no milk |
| Ridgeback Roast | Hot or iced | Oat, almond, whole, or no milk |
| Latte | Hot or iced | Oat, almond, whole (required) |
| Matcha latte | Hot or iced | Oat, almond, whole (required) |
| Hot chocolate | Skipped (always hot) | Skipped (no milk choice) |

Example: "a large iced cappuccino with oat milk", then the user picks hot chocolate.
Large is kept; iced is changed to hot and oat milk is dropped, and Hunter says so; the next question is extras.

## How the 6 required test cases map to this chart

| Test case | Where it happens |
|---|---|
| Normal completion | Ask next empty slot → Read back everything → yes → order placed |
| Missing information | "a latte" fills one slot → Ask next empty slot repeats until all are filled |
| Invalid answer | Asked for a drink not on the menu → closest match + drink buttons |
| Correction | Apply the answer: filled slot with a different value = correction; also "no, make it large" at confirm |
| Voice recognition problem | Found nothing → re-ask with options → after the second miss, suggest tapping or typing |
| Final confirmation | Read back everything → Yes, or no? |
