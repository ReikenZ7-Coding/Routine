// The desktop's week calendar. On the phone the calendar is the strip on Today, so a link here lands there.
import { Redirect } from 'expo-router';
import { CalendarPage } from '../components/desktop/CalendarPage';
import { useDesktop } from '../components/desktop/context';

export default function CalendarRoute() {
  const desktop = useDesktop();
  if (!desktop.on) return <Redirect href="/" />;
  return <CalendarPage />;
}
