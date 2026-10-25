/* LMTLSS shared domain types — strict-TS mirror of the shapes js/domain.js
   operates on (see js/store.js for the browser schema these derive from).
   Keeping them structural (optional fields + index signatures) lets partial
   state from any source (web store, mobile store, fixtures) flow through the
   same pure functions. */

export type Goal = "strength" | "hypertrophy" | "general" | "endurance" | "weight";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Unit = "metric" | "imperial";

export interface Profile {
  name?: string;
  goal: Goal;
  sports: string[];
  experience: Experience;
  daysPerWeek: number;
  equipment: string[];
  limitations?: string;
  seeded?: boolean;
  /** Per-exercise working-load profile: "Back Squat" -> { loadKg, reps, rpe?, stalled?, updatedAt? } */
  loadProfile?: Record<string, LoadProfileEntry>;
  [key: string]: unknown;
}

export interface LoadProfileEntry {
  loadKg: number;
  reps: number;
  rpe?: number;
  stalled?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SessionIntegrityFlag {
  /** "ok" | "review" — attached to a logged set when the app has reviewed it locally */
  integrity?: "ok" | "review";
  /** Human-readable reason when integrity is "review" */
  integrityReason?: string;
  [key: string]: unknown;
}

export interface ExerciseLibraryEntry {
  name: string;
  group: string;
  equip: string[];
  comp: boolean;
}

export interface PlannedExercise {
  name: string;
  targetSets: number;
  targetReps: number;
  /** null => ask the user, prefilled from history when known */
  targetLoad: number | null;
  lastLoad: number | null;
  lastReps: number | null;
  restSec: number;
}

export interface PlannedSession {
  id?: string;
  day?: string;
  title: string;
  sport: string;
  exercises: PlannedExercise[];
  estMinutes: number;
  targetRPE: number;
  [key: string]: unknown;
}

export interface Plan {
  sessions: PlannedSession[];
  rationale: string[];
}

export interface LoggedSet {
  reps?: number;
  load?: number;
  done?: boolean;
  rpe?: number | null;
  [key: string]: unknown;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
  [key: string]: unknown;
}

export interface SessionLog {
  id?: string;
  planId?: string; // set when the session was started from a plan item
  sport: string;
  title?: string;
  startedAt: string;
  durationSec?: number;
  distanceM?: number;
  distanceSource?: string;
  exercises?: LoggedExercise[];
  [key: string]: unknown;
}

export interface ReadinessEntry {
  date: string;
  energy?: number;
  soreness?: number;
  note?: string;
  [key: string]: unknown;
}

export interface HydrationEntry {
  date: string;
  ml: number;
  [key: string]: unknown;
}

export interface MealEntry {
  time: string;
  calories?: number;
  proteinG?: number;
  [key: string]: unknown;
}

/** One day of the recovery series (fuel + readiness + training load). */
export interface RecoveryDay {
  date: string;
  weekday: string;
  rest: boolean;
  readiness: { energy?: number; soreness?: number } | null;
  hydration: number | null;
  meals: number;
}

/** Plain-language rest-day suggestion — never a medical judgment. */
export interface RestDayKit {
  trainingDaysLast7: number;
  lowEnergyDaysLast7: number;
  suggestion: string | null;
  why: string;
  confidence: number;
  source: string;
}

/** Today's fuel totals, always carrying its own estimate label. */
export interface FuelSummary {
  date: string;
  hydrationMl: number;
  hydrationLogged: boolean;
  mealsLogged: number;
  mealCalories: number;
  mealProteinG: number;
  mealEstimateLabel: string;
}

export interface Settings {
  unit?: Unit;
  restSeconds?: number;
  weekStart?: string;
  [key: string]: unknown;
}

/** In-flight workout — clock math lives in domain (elapsedSec/resumeSession). */
export interface ClockState {
  elapsedBase: number;
  startMs: number;
  paused: boolean;
  updatedAt?: number;
  [key: string]: unknown;
}

/** App state as the domain sees it: every field optional, partials accepted. */
export interface AppState {
  version?: number;
  profile?: Profile | null;
  plan?: { sessions: PlannedSession[] } | null;
  log?: SessionLog[];
  readiness?: ReadinessEntry[];
  weekPlan?: WeekPlanState | null;
  hydration?: HydrationEntry[];
  meals?: MealEntry[];
  activeSession?: ClockState | null;
  coachThread?: { role?: string; text?: string; ts?: number }[];
  settings?: Settings;
  meta?: { createdAt?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface SessionResult {
  session: ClockState;
  frozen: boolean;
}

export interface WeekPoint {
  weekStart: number;
  vol: number;
  sets: number;
  runs: number;
  runM: number;
}

export interface StrengthPR {
  load: number;
  reps: number;
  date: string;
  e1rm: number;
  sessionId?: string;
}

export interface RunningPR {
  paceSec: number;
  distanceM: number;
  durationSec?: number;
  date: string;
  sessionId?: string;
}

export interface RunningIntervalSegment {
  index: number;
  segmentType: "work" | "rest";
  targetDurationSec: number;
  /** Recorded duration once the segment is done; null/absent while pending. */
  durationSec?: number | null;
  done?: boolean;
}

export interface RunningIntervalTemplate {
  name: string;
  segments: RunningIntervalSegment[];
}

export interface RunningIntervalSummary {
  segments: RunningIntervalSegment[];
  totalTime: number;
  distKm: number | null;
  avgPaceSecPerKm: number | null;
  totalWorkSec: number;
  totalRestSec: number;
  workCount: number;
  restCount: number;
  lastSegmentIndex: number;
  template: RunningIntervalTemplate | null;
  completedSegments: number;
}

export interface Insight {
  kind: "positive" | "neutral" | "warning";
  text: string;
  source: string;
}

export interface CoachAction {
  label: string;
  tab: string;
}

/* Adaptive calendar (explainable week rebalancing) */

export interface WeekChange {
  planId: string;
  title: string;
  sport: string;
  kind: "move" | "defer";
  trigger: "missed" | "readiness";
  fromDay: string;
  toDay: string | null;
  text: string;
  why: string;
  source: string;
}

export interface ReadinessSnapshot {
  date: string | null;
  energy: number | null;
  soreness: number | null;
  avg: number | null;
}

export interface RebalanceProposal {
  weekStart: string;
  changes: WeekChange[];
  moves: Record<string, string>; // planId -> day
  dropped: string[]; // planIds deferred out of this week
  readiness: ReadinessSnapshot | null;
  summary: string;
}

/** This week's applied adjustment, stored additively on state (never rewrites the template). */
export interface WeekPlanState {
  weekStart: string;
  moves?: Record<string, string>;
  dropped?: string[];
  changes?: WeekChange[];
  summary?: string;
  appliedAt?: string;
  dismissed?: boolean;
  dismissedAt?: string;
}

/** One equipment node shown in the gym-equipment selection screen. 
 * `pictureAsset` is the logo/ asset key used by screens-equipment.js / onboarding. */
export interface EquipmentNode {
  id: string;
  label: string;
  group: string;
  pictureAsset: string;
  equip: string[];
}

export interface CoachRecommendation {
  title: string;
  text: string;
  why: string;
  confidence: number;
  action: CoachAction | null;
}