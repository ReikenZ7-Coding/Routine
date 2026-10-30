import { type Routine, countOn, isDoneOn, isSkipped, routineSubtitle, tapRoutine } from '../lib/routines';
import { kinds } from '../theme';
import { CheckRow } from './CheckRow';

interface Props {
  routine: Routine;
  date: string;
  disabled?: boolean;
  onChange: (r: Routine) => void;
  onLongPress?: () => void;
}

/** A routine on a given day: tick it off, or +1 if it's a counter. */
export function RoutineRow({ routine: r, date, disabled, onChange, onLongPress }: Props) {
  const counter = !!r.target && r.target > 1;
  return (
    <CheckRow
      tint={kinds.routines.color}
      title={r.name}
      subtitle={routineSubtitle(r, date)}
      done={isDoneOn(r, date)}
      skipped={isSkipped(r, date)}
      count={counter ? { value: countOn(r, date), target: r.target! } : undefined}
      disabled={disabled}
      onToggle={() => onChange(tapRoutine(r, date))}
      onLongPress={onLongPress}
    />
  );
}
