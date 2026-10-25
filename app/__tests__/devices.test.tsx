/* The Devices screen must never imply a working connection.

   These assertions are deliberately about absence as much as presence: with no
   native module, no backend, and no link records, no row may say "Connected"
   and no row may offer a control. */

import { NavigationContainer } from '@react-navigation/native';
import { render, screen } from '@testing-library/react-native';

import DevicesScreen from '../src/screens/DevicesScreen';

function renderScreen() {
  return render(
    <NavigationContainer>
      <DevicesScreen />
    </NavigationContainer>,
  );
}

describe('Devices & watches screen', () => {
  it('lists every mechanism group and the representative providers', async () => {
    await renderScreen();

    expect(screen.getByText('Devices & watches')).toBeTruthy();
    expect(screen.getByText('On-device health stores')).toBeTruthy();
    expect(screen.getByText('Vendor cloud APIs')).toBeTruthy();
    expect(screen.getByText('Import hubs')).toBeTruthy();
    expect(screen.getByText('File import')).toBeTruthy();
    expect(screen.getByText('LMTLSS watch apps')).toBeTruthy();

    for (const label of [
      'Apple Health',
      'Health Connect',
      'Garmin',
      'Polar',
      'WHOOP',
      'Suunto',
      'COROS',
      'Oura',
      'Strava',
      'FIT / TCX / GPX file',
      'LMTLSS for Apple Watch',
      'LMTLSS for Wear OS',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('claims no connection when none exists', async () => {
    await renderScreen();

    expect(screen.getByText(/Nothing is connected yet/)).toBeTruthy();
    expect(screen.queryByText('Connected')).toBeNull();
  });

  it('names the real blocker for each kind of path', async () => {
    await renderScreen();

    expect(screen.getAllByText('Not in this build').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs backend').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not implemented').length).toBeGreaterThan(0);
  });

  it('offers exactly one usable path — the file importer — and no connect control', async () => {
    await renderScreen();

    expect(screen.getAllByText('Ready to connect')).toHaveLength(1);
    expect(screen.getByText('Choose a file')).toBeTruthy();
    expect(screen.queryByText('Connect')).toBeNull();
  });
});
