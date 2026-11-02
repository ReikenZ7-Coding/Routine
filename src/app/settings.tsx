// Settings as a page on the desktop. On the phone Settings is a sheet on Today, so a link here opens it there.
import { Redirect } from 'expo-router';
import { useDesktop } from '../components/desktop/context';
import { SettingsPage } from '../components/desktop/SettingsPage';

export default function SettingsRoute() {
  if (!useDesktop().on) return <Redirect href={{ pathname: '/', params: { open: 'settings' } }} />;
  return <SettingsPage />;
}
