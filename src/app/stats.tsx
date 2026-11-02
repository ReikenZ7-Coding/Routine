// "Your week" as a page on the desktop. On the phone it is a sheet on Today, so a link here opens it there.
import { Redirect } from 'expo-router';
import { useDesktop } from '../components/desktop/context';
import { WeekPage } from '../components/desktop/WeekPage';

export default function StatsRoute() {
  if (!useDesktop().on) return <Redirect href={{ pathname: '/', params: { open: 'stats' } }} />;
  return <WeekPage />;
}
