// The forms the desktop shell opens from anywhere (the New menu, the command palette, a page's actions, a calendar
// slot): the same forms as the phone's Add sheet, and Backup. On a wide window each Sheet presents itself as the
// floating panel on the right. Settings and Your week are pages of their own on the desktop.
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { currentLanguage, newWord } from '../../lib/language';
import { type Routine, isScheduled, isSkipped, toggleSkip } from '../../lib/routines';
import { newId, useStore } from '../../lib/store';
import { BackupSheet } from '../BackupSheet';
import { Button } from '../Button';
import { Field, Input } from '../Field';
import { GroceryForm } from '../GroceryForm';
import { type RoutineFields, RoutineForm } from '../RoutineForm';
import { Sheet } from '../Sheet';
import { WordForm } from '../WordForm';
import type { ShellPanel } from './api';
import { longDate } from './nav';

export function Panels({
  panel,
  editing,
  draft,
  day,
  onOpen,
  onClose,
}: {
  panel: ShellPanel;
  editing?: Routine;
  /** A new routine's starting values (a calendar slot). */
  draft?: Partial<RoutineFields>;
  /** The day Today is showing, when it is not today: a new to-do goes on it. */
  day?: string;
  onOpen: (p: ShellPanel) => void;
  onClose: () => void;
}) {
  const { today, routines, updateRoutines, addGrocery, language, updateLanguage, updateInbox } = useStore();
  const [todo, setTodo] = useState('');
  const [todoError, setTodoError] = useState<string | undefined>();
  const studying = currentLanguage(language);
  const live = editing && routines.find((r) => r.id === editing.id);
  const replace = (r: Routine) => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? r : x)));
  const close = () => {
    setTodoError(undefined);
    onClose();
  };
  const on = day && day !== today ? day : today;
  const onLabel = on === today ? 'today' : longDate(on);
  const addTodo = () => {
    const title = todo.trim();
    if (!title) return setTodoError('Write what you want to do first.');
    updateInbox((items) => [{ id: newId(), title, date: on, createdAt: new Date().toISOString() }, ...items]);
    setTodo('');
    close();
  };

  return (
    <>
      <Sheet visible={panel === 'todo'} title="New to-do" onClose={close}>
        <Field label={`To-do for ${onLabel}`} error={todoError}>
          <Input
            value={todo}
            onChangeText={(t) => {
              setTodo(t);
              setTodoError(undefined);
            }}
            onSubmitEditing={addTodo}
            invalid={!!todoError}
            placeholder="Call Mum, book the dentist…"
            autoFocus
            returnKeyType="done"
            accessibilityLabel="New to-do"
          />
        </Field>
        <Button label={`Add for ${onLabel}`} onPress={addTodo} style={styles.save} />
      </Sheet>
      <RoutineForm
        visible={panel === 'routine'}
        routine={editing}
        draft={draft}
        onClose={close}
        onSave={(f) => {
          updateRoutines((rs) =>
            editing ? rs.map((r) => (r.id === editing.id ? { ...r, ...f } : r)) : [...rs, { ...f, id: newId(), doneDates: [] }],
          );
          close();
        }}
        skippedToday={!!live && isSkipped(live, today)}
        onSkip={
          live && isScheduled(live, today)
            ? () => {
                replace(toggleSkip(live, today));
                close();
              }
            : undefined
        }
        onDelete={
          editing
            ? () => {
                updateRoutines((rs) => rs.filter((r) => r.id !== editing.id));
                close();
              }
            : undefined
        }
      />
      <GroceryForm
        visible={panel === 'grocery'}
        onClose={close}
        onSave={(g) => {
          addGrocery(g);
          close();
        }}
      />
      <WordForm
        visible={panel === 'word'}
        language={studying}
        onClose={close}
        onSave={(f) => {
          if (studying)
            updateLanguage((l) => ({ ...l, words: [...l.words, newWord(newId(), f.hanzi, f.pinyin, f.meaning, studying.id, today)] }));
          close();
        }}
      />
      <BackupSheet visible={panel === 'backup'} onClose={close} />
    </>
  );
}

const styles = StyleSheet.create({ save: { marginTop: 20 } });
