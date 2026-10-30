// Local notifications for routines with a reminder time. Android only; the web preview skips this.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { type Routine, reminderTriggers } from './routines';

const CHANNEL = 'reminders';
export const remindersSupported = Platform.OS !== 'web';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Ask once, when someone first turns a reminder on. */
export async function allowReminders(): Promise<boolean> {
  if (!remindersSupported) return false;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Routine reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Rebuild every scheduled reminder from the routines (simple, and always in sync). */
export async function syncReminders(routines: Routine[]): Promise<void> {
  if (!remindersSupported) return;
  const wanted = routines.flatMap((r) => reminderTriggers(r).map((t) => ({ r, t })));
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (wanted.length === 0) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Routine reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  for (const { r, t } of wanted) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.name, body: r.target ? `Goal today: ${r.target}` : 'Time for your routine' },
      trigger:
        t.weekday !== undefined
          ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, channelId: CHANNEL, weekday: t.weekday, hour: t.hour, minute: t.minute }
          : { type: Notifications.SchedulableTriggerInputTypes.DAILY, channelId: CHANNEL, hour: t.hour, minute: t.minute },
    });
  }
}
