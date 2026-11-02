// Groceries as a page of its own on the desktop. On the phone the list is a shelf of the Library.
import { Redirect } from 'expo-router';
import { useDesktop } from '../components/desktop/context';
import { PageTitle } from '../components/PageTitle';
import { boughtOn, needsBuying } from '../lib/schedule';
import { useStore } from '../lib/store';
import GroceriesScreen from '../screens/GroceriesScreen';

export default function GroceriesRoute() {
  const desktop = useDesktop();
  const { groceries, today } = useStore();
  if (!desktop.on) return <Redirect href={{ pathname: '/library', params: { shelf: 'groceries' } }} />;
  const left = groceries.filter((g) => needsBuying(g, today)).length;
  const bought = groceries.filter((g) => boughtOn(g, today)).length;
  const subtitle = groceries.length ? `${left} to buy today · ${bought} bought` : 'Your shopping list, by aisle';
  return <GroceriesScreen query="" header={<PageTitle title="Groceries" subtitle={subtitle} />} onClearQuery={() => {}} />;
}
