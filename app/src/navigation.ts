/* Route names in one place so screens and App.tsx cannot drift. */

export type RootStackParamList = {
  Today: undefined;
  Devices: undefined;
  Import: undefined;
  Account: undefined;
  Run: undefined;
  RunSummary: {
    runId: string;
  };
  RunShare: {
    runId: string;
  };
};
