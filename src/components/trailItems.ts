// The day's trail and its Balance rings, built from a day plan. Shared by the phone's Today and the desktop's Today
// page, so both list the same steps in the same order with the same words; each screen says what a press does.
import type { DayPlan } from '../lib/day';
import { type LanguageState, practiceTitle, shortTitle } from '../lib/language';
import { plural } from '../lib/plural';
import { type Routine, countOn, iconFor, isDoneOn, isSkipped } from '../lib/routines';
import { boughtOn } from '../lib/schedule';
import type { Theme } from '../theme';
import type { BalanceRing, TrailItem } from './TrailHome';

export interface TrailActions {
  /** Tick off (or count one of) a routine on the day. */
  tap: (r: Routine) => void;
  /** Open a routine's form. */
  edit: (r: Routine) => void;
  /** Tick a to-do on the day, or untick it. */
  toggleTodo: (id: string) => void;
  gym: () => void;
  language: () => void;
  groceries: () => void;
  /** The desktop's visible edit button on each routine (the phone edits with a long press). */
  more?: boolean;
}

/** The day's things in one list: routines, to-dos, then the workout, practice and shopping, so the trail matches
 *  the progress count. */
export function trailItems(
  plan: DayPlan,
  day: { selected: string; today: string },
  language: LanguageState,
  kinds: Theme['kinds'],
  toReview: number,
  act: TrailActions,
): TrailItem[] {
  const { selected, today } = day;
  const isPast = selected < today;
  const isFuture = selected > today;
  const { session, gym: gymProgress, gymDone, showPractice, practice } = plan;
  const dayGroceries = plan.groceries;
  return [
    ...plan.routines.map((r) => {
      const count = r.target ? countOn(r, selected) : 0;
      const when = r.start ? `${r.start}${r.duration ? ` · ${r.duration} min` : ''}` : 'Anytime';
      return {
        key: r.id,
        title: r.name,
        icon: iconFor(r),
        color: kinds.routines.color,
        ink: kinds.routines.text,
        meta: isSkipped(r, selected) ? 'Skipped today' : r.target ? `${when} · ${count}/${r.target}` : when,
        done: isDoneOn(r, selected),
        skipped: isSkipped(r, selected),
        progress: r.target && r.target > 1 ? { value: count, total: r.target } : undefined,
        // A day still to come can be planned but not ticked off: a tap opens the routine to change it.
        planOnly: isFuture,
        onPress: isFuture ? () => act.edit(r) : () => act.tap(r),
        onLongPress: () => act.edit(r),
        onMore: act.more && !isFuture ? () => act.edit(r) : undefined,
      };
    }),
    ...plan.todos.map((t) => ({
      key: t.id,
      title: t.title,
      meta: 'To-do',
      icon: 'checkbox-outline',
      color: kinds.inbox.color,
      ink: kinds.inbox.text,
      done: !!t.doneOn,
      planOnly: isFuture,
      onPress: isFuture ? undefined : () => act.toggleTodo(t.id),
    })),
    ...(session && gymProgress
      ? [
          {
            key: 'gym',
            title: session.name,
            icon: 'barbell',
            color: kinds.gym.color,
            ink: kinds.gym.text,
            meta: `Workout · ${gymProgress.done}/${gymProgress.total} sets`,
            done: gymDone,
            nav: true,
            progress: { value: gymProgress.done, total: gymProgress.total },
            onPress: act.gym,
          },
        ]
      : []),
    ...(showPractice
      ? [
          {
            key: 'chinese',
            title: practiceTitle(language.languages),
            icon: 'language',
            color: kinds.chinese.color,
            ink: kinds.chinese.text,
            meta: `${practice.minutes}/${language.target} min${toReview ? ` · ${plural(toReview, 'word')} to review` : ''}`,
            done: plan.practiceDone,
            nav: true,
            progress: { value: practice.minutes, total: language.target },
            onPress: act.language,
          },
        ]
      : []),
    ...(dayGroceries.length > 0
      ? [
          {
            key: 'groceries',
            title: isPast ? 'Groceries bought' : 'Groceries',
            icon: 'basket',
            color: kinds.groceries.color,
            ink: kinds.groceries.text,
            meta: `${dayGroceries.filter((g) => boughtOn(g, selected)).length} of ${dayGroceries.length} bought · ${dayGroceries
              .slice(0, 3)
              .map((g) => g.name)
              .join(', ')}${dayGroceries.length > 3 ? '…' : ''}`,
            done: dayGroceries.every((g) => boughtOn(g, selected)),
            nav: true,
            onPress: act.groceries,
          },
        ]
      : []),
  ];
}

/** The three Balance rings: routines, the workout's sets and practice minutes. */
export function balanceRings(plan: DayPlan, selected: string, language: LanguageState, kinds: Theme['kinds']): BalanceRing[] {
  const { planned, gym: gymProgress, practice, showPractice } = plan;
  return [
    {
      label: 'Routines',
      value: planned.filter((r) => isDoneOn(r, selected)).length,
      total: planned.length,
      unit: planned.length === 1 ? 'routine' : 'routines',
      color: kinds.routines.color,
    },
    {
      label: 'Gym',
      value: gymProgress?.done ?? 0,
      total: gymProgress?.total ?? 0,
      unit: 'sets',
      color: kinds.gym.color,
    },
    {
      // The balance ring has room for the language's name (up to ten letters).
      label: shortTitle(language.languages),
      value: practice.minutes,
      total: showPractice ? language.target : 0,
      unit: 'min',
      color: kinds.chinese.color,
    },
  ];
}
