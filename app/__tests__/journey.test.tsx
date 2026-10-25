/* The M1 slice's primary user journey, exercised through the real UI:
   onboarding -> domain-generated plan -> Today -> log readiness + hydration
   -> the JSON document on the device actually contains it.

   This is the only automated check that the screens render at all; the store
   tests cover restart/migration/failure paths without a renderer. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from '../App';
import { preloadLogo } from '../src/components/ui';

// Ensure logo is preloaded before first render in tests, so the Logo
// component doesn't trigger a require() guard on the initial pass.
beforeEach(() => preloadLogo());
import { STORAGE_KEY } from '../src/store/storage';

describe('M1 slice: onboarding to a saved day', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('builds a real plan, logs the day, and writes it to device storage', async () => {
    const view = await render(<App />);

    // Ensure the logo is preloaded before the screens render, so the Logo
    // component doesn't hit the require() guard during the first render pass.
    preloadLogo();

    // A new phone sees the account choice first. It is a choice, not a wall.
    expect(await screen.findByText('Use without an account')).toBeTruthy();
    await fireEvent.press(screen.getByText('Use without an account'));

    // Boot gate resolves into onboarding.
    expect(await screen.findByText(/Let's build your week/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Patri');
    await fireEvent.press(screen.getByText('Build strength'));
    await fireEvent.press(screen.getByText('Continue'));

    // Week step: four days, strength + running.
    expect(await screen.findByText('How does your week look?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('More days'));
    await fireEvent.press(screen.getByText('Running'));
    await fireEvent.press(screen.getByText('Continue'));

    expect(await screen.findByText('What do you train with?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Build my plan'));

    // Today, with a session the shared domain generated.
    expect(await screen.findByText('Hi, Patri.')).toBeTruthy();
    expect(
      screen.getAllByText(/Push \+ Squat|Pull \+ Hinge|Full Body|Easy Run|Long Run/).length,
    ).toBeGreaterThan(0);

    // Write path: hydration (+250 twice) and readiness.
    await fireEvent.press(screen.getByText('+250 ml'));
    await waitFor(() => expect(screen.getByText('250')).toBeTruthy());
    await fireEvent.press(screen.getByText('+250 ml'));
    await waitFor(() => expect(screen.getByText('500')).toBeTruthy());

    await fireEvent.press(screen.getByText('4'));
    await waitFor(() =>
      expect(screen.getByText(/Logged today: energy 4\/5/)).toBeTruthy(),
    );

    // The same values exist in the persisted document, not just in memory.
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(raw).toContain('"name":"Patri"');
    });

    const saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}');
    expect(saved.version).toBe(1);
    expect(saved.profile.goal).toBe('strength');
    expect(saved.profile.sports).toEqual(expect.arrayContaining(['strength', 'running']));
    expect(saved.plan.sessions).toHaveLength(4);
    expect(saved.hydration).toHaveLength(1);
    expect(saved.hydration[0].ml).toBe(500);
    expect(saved.readiness).toHaveLength(1);
    expect(saved.readiness[0].energy).toBe(4);    await view.unmount();
    // RNTL 14 re-renders the whole tree per event; this journey takes ~7s here.
  }, 30000);
});
