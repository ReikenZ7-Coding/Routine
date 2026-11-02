// The desktop's home. The phone has no Overview: Today is its home, so a link here lands there.
import { Redirect } from 'expo-router';
import { useDesktop } from '../components/desktop/context';
import { Overview } from '../components/desktop/Overview';

export default function OverviewRoute() {
  const desktop = useDesktop();
  if (!desktop.on) return <Redirect href="/" />;
  return <Overview />;
}
