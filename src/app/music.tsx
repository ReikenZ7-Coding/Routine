// Music as a page on the desktop. On the phone music lives in Now Playing, which this opens.
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useDesktop } from '../components/desktop/context';
import { MusicPage } from '../components/desktop/MusicPage';
import { useSounds } from '../lib/sounds';

export default function MusicRoute() {
  const desktop = useDesktop();
  const { setSheetOpen } = useSounds();
  useEffect(() => {
    if (!desktop.on) setSheetOpen(true);
  }, [desktop.on, setSheetOpen]);
  if (!desktop.on) return <Redirect href="/" />;
  return <MusicPage />;
}
