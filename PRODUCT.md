# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

People who struggle to organise their day. They forget things they meant to do, lose track of time, and end up not getting to the tasks that matter. They open Routine on an Android phone several times a day, often for a few seconds: in the morning to see what the day holds, between things to tick something off, in the evening to see how the day went.

## Product Purpose

Routine helps people remember their daily tasks and manage their time better. If someone can't sort out their daily tasks, they don't get to them and don't spend their time well. Routine gives them one place that tells them what is next, reminds them before it's due, and shows how their day and week are going, so they can build better habits.

Success means a person who used to forget things opens the app, knows within a glance what to do next, does it, and comes back the next day.

## Positioning

Decided by the builder (Matthew delegated it, 2026-11-01): one calm daily companion for every kind of routine. Habits, gym sessions, language practice and the shopping list live on a single timeline for the day, with reminders, instead of being spread across four separate apps. The person chooses the look that suits them, and each look is a complete world of its own, not a colour swap.

## Operating Context

- Glanced at on a phone, often one-handed, between other things.
- The day view is the centre: what is next, what is done, what was skipped.
- Reminders (local notifications) bring people back before a routine is due.
- Ticking something off should feel rewarding, because the reward is what builds the habit.

## Capabilities and Constraints

- Routines with time, duration, icon, repeat days, counters, skip-today (keeps the streak), pin, and reminders.
- Day timeline with a week and month calendar; Inbox for quick captures; Library for routines and groceries with search and filters.
- Gym: weekly session plans, set logging, working weight, last-time and PR badges, history.
- Chinese: word review with spaced repetition and a focus timer. It has no relation to Matthew's Street Mandarin app.
- Groceries list with sharing; daily mood and note; weekly stats; focus sounds; backup export and restore.
- Settings: name and one of four looks (Lavender, Stone, Paper, Pine).
- Built with Expo SDK 58 and React Native (new architecture). Android APKs are built by GitHub Actions on every push.
- Saved data must survive every redesign. The AsyncStorage keys (`routine.*.v1`) and data shapes stay compatible.
- Matthew wants every screen and every look reworked (2026-11-01). Features stay; their presentation is open.
- No music streaming (licensing, off purpose) and no AI tab (needs a paid key).

## Brand Commitments

- Name: Routine.
- Voice: warm, friendly, plain words; encouraging, never scolding.
- Four looks, chosen in Settings: Lavender, Stone, Paper and Pine. Each one is modelled on a reference Matthew supplied (in `routine-looks` project memory).
- Must not look like generic AI-made design. Quality means it works extremely well and the design is impeccable.

## Evidence on Hand

- No real users, testimonials or metrics yet. Do not fabricate any.
- Starter templates (routines, gym plans) are generic, not personal data.

## Product Principles

1. Next thing first: every screen answers "what do I do now?" before anything else.
2. Remembering is the product. Reminders, streaks and the day view exist to stop people forgetting, and they must be reliable.
3. Reward the tick. Completing something should feel good and visible, without guilt for what was missed.
4. One place, many kinds of routine, each with its own colour and tools, sharing one day.
5. Craft is function: speed, clarity and accessibility come before decoration.

## Accessibility & Inclusion

Matthew's standing rules apply to every screen: text contrast of at least 4.5:1; accessibility labels on icon-only buttons; focus rings never removed; touch targets of at least 44x44 with at least 8px spacing; loading feedback; 16px base body text; semantic colour tokens; no grey on grey; no emoji as icons; no hover-only actions; no instant 0ms state changes; no placeholder-only labels; at most 5 bottom-nav items. Motion respects the system's reduced-motion setting.
