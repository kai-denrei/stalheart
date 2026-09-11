---
name: architecture-review
description: Use when reviewing a Stalheart commit, diff or proposed change for structural regressions before building on it, or when asked whether a change respects the layer boundaries. Not a general code review.
---

# Architecture review

Find structural regressions in the diff without redesigning healthy code. Scope is the changed files and the modules they touch; expand only when an ownership or dependency question requires it.

## Required evidence, in this order

1. `git show --stat <rev>` or `git diff --stat`. State the net line change of `src/td-tab.js` and of every other file over 1,000 lines. Growth of the controller is a finding, not background.
2. `npm run architecture`. Quote the result. The guard covers `src/core`, `src/domain`, `src/content`, controller/lab coupling, the controller line budget and top-level placement; everything else is your job.
3. For each new concept in the diff, grep `src/domain/`, `src/core/`, `src/labs/` and `src/content/` for an existing owner of the same concept and say what you found. New code that reimplements an existing domain module (for example manual aiming beside `src/domain/manual-weapon.js`) is a parallel implementation.

## Check for

- Rules or state added inline to the controller instead of a domain module.
- Wrong dependency direction, cycles, game importing a lab or a lab importing the game.
- Module-load side effects that read `location`, storage or globals; flags parsed in more than one place.
- The same fix applied at several call sites where one helper would close the gap.
- Key-string special cases (`tw.key==='lancer'`) where a content flag belongs.
- Feature-specific branches leaking into shared builders, effects or audio.
- Tests that cover the boundary that changed, not only the happy path.

## Output

A review has these parts, in order: what was checked, with the guard result and controller line delta; findings with `file:line`, most structural first; what to repair now and what to leave; one recommendation on whether to build on the change. Keep performance and style notes in a separate short list.

## Repair policy

Repair mechanical violations only when behavior is provably preserved and the task allows edits. Do not start a redesign; state the trade-off and let the owner decide. Record accepted findings with `/deban`.
