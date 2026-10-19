/* The app's single door to the shared domain.

   shared/ is pure TypeScript (no React Native, no storage, no DOM) and is the
   same code the web app runs at js/domain.js — a Jest guard fails if their
   public APIs drift. Metro reaches it via watchFolders in metro.config.js.

   Screens and the store import from here, never from ../../shared directly,
   so this file stays the one place that knows where the domain lives. */

export * from '../../shared/src';
