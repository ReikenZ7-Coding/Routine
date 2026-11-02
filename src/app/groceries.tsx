// Groceries as a page of its own on the desktop. On the phone the list is a shelf of the Library.
import { Redirect } from 'expo-router';
import { useDesktop } from '../components/desktop/context';
import { GroceriesPage } from '../components/desktop/GroceriesPage';

export default function GroceriesRoute() {
  const desktop = useDesktop();
  if (!desktop.on) return <Redirect href={{ pathname: '/library', params: { shelf: 'groceries' } }} />;
  return <GroceriesPage />;
}
