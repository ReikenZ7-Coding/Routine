// Read-only bridge to the calendars already on the phone (Google, Samsung, Outlook…),
// so a day in Routine shows your existing events next to your routines.
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import { dateKey } from './schedule';

export interface PhoneEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
}

export const calendarSupported = Platform.OS !== 'web';

/** Ask for permission. Returns true when Routine may read the phone's calendars. */
export async function connectPhoneCalendar(): Promise<boolean> {
  if (!calendarSupported) return false;
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/** Events between two dates from every calendar on the phone, grouped by local date key. */
export async function phoneEventsByDay(start: Date, end: Date): Promise<Record<string, PhoneEvent[]>> {
  if (!calendarSupported) return {};
  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status !== 'granted') return {};
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (calendars.length === 0) return {};
  const colorOf = new Map(calendars.map((c) => [c.id, c.color]));
  const events = await Calendar.getEventsAsync(
    calendars.map((c) => c.id),
    start,
    end,
  );
  const byDay: Record<string, PhoneEvent[]> = {};
  for (const e of events) {
    const s = new Date(e.startDate);
    const en = new Date(e.endDate);
    // Put multi-day events on every day they touch (the end time is exclusive).
    const last = new Date(Math.max(s.getTime(), en.getTime() - 1));
    for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d <= last; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d);
      (byDay[key] ??= []).push({
        id: `${e.id}-${key}`,
        title: e.title || 'Busy',
        start: s,
        end: en,
        allDay: !!e.allDay,
        color: colorOf.get(e.calendarId),
      });
    }
  }
  for (const list of Object.values(byDay)) list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
  return byDay;
}

export function formatEventTime(e: PhoneEvent): string {
  if (e.allDay) return 'All day';
  const t = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${t(e.start)}–${t(e.end)}`;
}
