# LMTLSS 2.0 — The complete product engineering prompt

> Canonical master brief, adopted into this repository from the product owner (October 2026).
> Pair it with [MOBILE-REQUIREMENTS-PROMPT.md](MOBILE-REQUIREMENTS-PROMPT.md) (the iOS/Android appendix) when briefing a builder.
> Derivative planning documents: [PRD.md](PRD.md) · [MOBILE-SPEC.md](MOBILE-SPEC.md).

The next version of LMTLSS should be designed as a multi-sport performance platform + AI training ecosystem + social athletic club. Not a gym app with a running tab added to it.

The important distinction is that every discipline gets its own training system, athlete profile, metrics, AI logic, and social experience, while all disciplines share one identity, one account, one performance history, and one community.

That means a bodybuilder, marathon runner, BJJ practitioner, Taekwondo athlete, Krav Maga student, basketball player, and pickleball player can all use LMTLSS without feeling like they're using a product designed for somebody else.

# LMTLSS — Ultimate Product & Engineering Master Prompt

## 1. THE MISSION

Build LMTLSS, a premium, AI-native, multi-sport training and social performance platform.

LMTLSS combines the capabilities of a personal coach, strength-training tracker, endurance analytics platform, martial arts training companion, sport-specific development system, and athletic community.

The ambition is to support practically every form of training and sport, from bodybuilding and marathon running to Taekwondo, Krav Maga, Brazilian Jiu-Jitsu, basketball, and pickleball.

The platform must not be a collection of generic templates. Every sport must have its own carefully engineered product experience, domain model, training methodology, performance metrics, AI capabilities, athlete profile, and community interactions.

The unifying idea:

**One athlete. Every discipline. One performance identity.**

The product should make people want to use it to train, proud to show their progress, and motivated to invite other athletes.

## 2. BRAND SYSTEM — NON-NEGOTIABLE

Primary colors:

- Black: #000000
- Electric green: #61EB1A

Supporting neutrals may include white, charcoal, dark gray, and muted gray. Do not introduce competing accent colors.

Design principles:

- Premium financial-product polish inspired by Revolut.
- The clarity and restraint associated with Apple.
- The performance depth of advanced athletic software.
- The visual energy of modern sports culture.
- The friendliness of an approachable training club.

Use black as the dominant canvas and green for meaningful interactions, active states, key metrics, and progress.

The interface must remain clean, accessible, and readable. Do not turn every component into a glowing neon card.

Create an original LMTLSS design language, iconography, component library, motion system, and brand identity. Reference other products for functional inspiration only; do not reproduce their signature layouts or proprietary assets.

## 3. THE FIVE PRODUCT PILLARS

### Pillar A — TRAIN

A complete training environment with discipline-specific tools.

### Pillar B — INTELLIGENCE

AI that understands the user's sport, goals, training history, performance, constraints, and progression.

### Pillar C — PERFORMANCE

A unified athlete profile with records, activity history, development trends, and cross-sport insights.

### Pillar D — CLUB

A social ecosystem built around clubs, training partners, events, challenges, shared progress, and community identity.

### Pillar E — IDENTITY

Beautiful, personalized athlete profiles and shareable performance artifacts that turn real progress into organic brand exposure.

All five pillars must work together as one product.

## 4. THE SPORT ENGINEERING FRAMEWORK

This is the most important architectural requirement.

Do not implement every sport through one generic workout builder.

For every new sport, follow a formal Sport System Specification before writing its UI or business logic.

### Required specification for every sport

**1. Domain definition**

- What the sport is.
- Its disciplines and subdisciplines.
- Its typical user profiles.
- How practitioners train.
- What improvement means within that sport.

**2. Athlete profile**

- Experience and skill level.
- Relevant qualifications, grades, belts, or competitive categories where applicable.
- Primary goals.
- Training frequency and availability.
- Equipment, facilities, and training environment.
- Relevant performance history.
- Optional coach, club, team, and competition affiliations.

Only collect information that serves a real product purpose.

**3. Training ontology**

Define the core concepts unique to the discipline.

For strength training, this may include exercises, sets, repetitions, loads, rest periods, and movement patterns.

For running, it may include routes, splits, pace, intervals, elevation, distance, and race goals.

For BJJ, it may include techniques, positions, transitions, escapes, submissions as technical categories, drilling, rolling sessions, and competition preparation.

For basketball, it may include skills sessions, shooting practice, conditioning, team practice, game statistics, and position-specific development.

**4. Metrics and scoring**

Define:

- What can be measured reliably.
- What must be entered manually.
- What can be estimated.
- What requires external sensors or integrations.
- Which comparisons are meaningful.
- Which metrics should never be compared across unrelated sports.

Do not invent universal athletic scores that obscure meaningful differences between disciplines.

**5. Training workflows**

Specify the full journey:

- Onboarding.
- Baseline assessment.
- Goal selection.
- Plan creation.
- Session preparation.
- Live session interaction.
- Completion and logging.
- Performance analysis.
- Progression.
- Social sharing.

**6. AI capabilities**

Define which tasks require AI, which should use deterministic calculations, and which require a qualified human coach.

**7. Social layer**

Determine how people within this discipline connect, train together, share achievements, discover clubs, and celebrate progress.

**8. Safety and quality assurance**

Identify sport-specific risks, data limitations, inappropriate recommendations, and the tests required before release.

### The sport specification output

For each sport, the engineering agent must produce:

1. Sport system specification.
2. Athlete profile schema.
3. Activity and performance data schema.
4. Screen-by-screen UX flow.
5. Design components and interaction states.
6. AI task specification.
7. API and integration requirements.
8. Validation and safety rules.
9. Acceptance criteria.
10. Automated and manual test plan.

Do not mark a sport complete until its essential workflows work end to end.

## 5. SPORT-SPECIFIC PRODUCT SYSTEMS

### A. Strength, bodybuilding and muscle development

Build a complete strength and physique-development system.

Capabilities:

- Exercise library with muscle groups and movement patterns.
- Workout builder.
- Sets, repetitions, load, rest, and exercise notes.
- Supersets and configurable training structures.
- Previous-session comparisons.
- Personal records and estimated strength trends.
- Training-volume history.
- Exercise substitutions.
- Equipment-aware workout creation.
- Training split planning.
- Progressive overload recommendations.
- Fatigue and recovery considerations.
- Mobility and technique resources.
- Nutrition support.
- Goal-oriented training phases.
- Longitudinal performance history.

AI capabilities:

- Generate personalized programs.
- Explain programming choices.
- Suggest appropriate exercise substitutions.
- Identify stagnating performance trends.
- Suggest adjustments based on actual logs and reported recovery.
- Help users understand technique and training principles.
- Adapt sessions to available time and equipment.

Distinguish recorded performance from estimated strength, volume, or future outcomes. Do not promise specific physique changes.

### B. Running and endurance

Build a dedicated endurance platform with a rich, visual activity-recording experience.

Capabilities:

- Outdoor running, treadmill running, trail running, and race preparation.
- GPS routes where supported.
- Distance, duration, pace, splits, elevation, and heart rate where available.
- Interval sessions and structured workouts.
- Personal bests and race history.
- Training plans for different distances and experience levels.
- Weekly training history.
- Route discovery where reliable map data is available.
- Performance and training-load trends.
- Recovery-aware scheduling.

AI capabilities:

- Adapt training plans to progress and availability.
- Suggest appropriate workouts.
- Explain pace and performance trends.
- Help prepare for a target race.
- Identify inconsistencies in logged data.
- Provide transparent explanations for recommended adjustments.

### C. Martial arts and combat sports

Create distinct systems for each discipline. Do not treat martial arts as one generic category.

**Taekwondo**

- Belt and rank history where relevant.
- Forms and technique practice.
- Kicking technique categories.
- Footwork and mobility.
- Sparring-session logs.
- Competition preparation.
- Coach feedback and skill-development goals.

**Krav Maga**

- Training sessions and curriculum progression.
- Technique practice categories.
- Conditioning and mobility.
- Instructor feedback.
- Scenario-based training records.
- Responsible, safety-first educational guidance.

**Brazilian Jiu-Jitsu**

- Belt and stripe progression where applicable.
- Gi and no-gi training.
- Position and transition tracking.
- Technique study and drilling.
- Rolling-session logs.
- Training partners and academy affiliations.
- Competition preparation and match records.

**Other disciplines** — Design independent systems for boxing, Muay Thai, wrestling, judo, MMA, karate, and other martial arts as they are introduced.

For every discipline, consult credible domain experts and validate its training model. Never assume that a generic AI model is qualified to author an entire martial arts curriculum without expert review.

### D. Team and court sports

**Basketball**

- Position and role.
- Shooting and skill-development sessions.
- Practice and game history.
- Supported individual and team statistics.
- Conditioning and movement training.
- Team and club profiles.
- Optional coach feedback.
- Goals for technical and athletic development.

**Pickleball**

- Singles and doubles.
- Practice sessions and match logs.
- Partner and club discovery.
- Match history and supported scoring.
- Skill-development goals.
- Tournament and event records where data is available.

Extend the framework to tennis, football, volleyball, badminton, squash, and other racket or team sports.

Do not impose the same statistical model on every sport.

### E. Endurance, outdoor and other training

Build modular support for:

- Cycling.
- Swimming.
- Walking and hiking.
- Triathlon.
- Trail sports.
- Climbing.
- Rowing.
- Functional fitness.
- Cross-training.
- Calisthenics.
- Olympic weightlifting.
- Powerlifting.
- Mobility and flexibility.
- Yoga.
- Other validated athletic disciplines.

Use a common platform foundation and specialized sport modules.

## 6. THE LMTLSS ATHLETE IDENTITY

Every user receives a unified athlete profile.

The profile should include:

- Profile image and personal identity.
- Selected sports and disciplines.
- Training experience and relevant ranks.
- Current goals.
- Clubs and teams.
- Selected public achievements.
- Personal records.
- Activity history.
- Progress over time.
- Completed challenges.
- Training streaks, when meaningful.
- Shareable activity cards.
- Privacy and visibility controls.

Users should be able to present themselves as a runner, lifter, martial artist, team-sport athlete, or multi-sport athlete.

Allow users to choose what is public. Do not expose sensitive health information, precise routes, or private training records by default.

### Cross-sport identity

The profile should tell the story of the athlete as a whole.

A user might be developing strength, preparing for a marathon, and training BJJ simultaneously. LMTLSS should let them represent all three without creating three disconnected accounts.

Create useful cross-sport insights only when the underlying data supports them.

## 7. RUNNING ACTIVITY CARDS AND VIRAL SHARING

Create an original activity-sharing system inspired by the usefulness of Strava's shareable run summaries.

The objective is to turn an authentic training session into a polished artifact that users voluntarily share.

### Running card formats

**Route card**

- Route map or simplified route visualization.
- Distance.
- Duration.
- Average pace.
- Elevation gain where available.
- Date and activity type.
- LMTLSS branding.

**Performance card**

- Personal best or meaningful milestone.
- Current result.
- Relevant previous result when available.
- Clear, readable typography.
- Minimal black-and-green design.

**Training recap**

- Weekly distance or completed sessions.
- Goal progress.
- A useful summary of the athlete's consistency.
- A compact visual representation of the week.

**Race card**

- Race name and distance.
- Official or user-recorded result, clearly identified.
- Splits and pace when available.
- Personal-best designation only when verified against available history.

**Multi-sport card**

- A curated recap of different activities.
- A unified weekly or monthly training story.
- Separate, clearly labeled metrics for each sport.

### Design requirements

- Canvas optimized for social sharing in 9:16 and 4:5 formats.
- Optional square format.
- High-quality map rendering.
- Legible metrics at mobile size.
- Exact brand colors: #000000 and #61EB1A.
- Original layouts and visualizations.
- Optional captions and personal notes.
- Optional profile link or QR code.
- Export without forcing users to post publicly.

Never copy Strava's branded templates, proprietary assets, or exact signature visual layouts.

### Sharing workflow

1. User completes an activity.
2. LMTLSS validates available activity data.
3. The app generates several relevant card designs.
4. The user previews and customizes a card.
5. The user saves it or shares through the device's native sharing interface.
6. The artifact optionally includes a referral link.
7. Referral attribution is recorded only when the user has consented to the relevant tracking.

The card should be worth sharing even if the user removes all promotional text.

Do not require public posting to unlock core features.

## 8. LMTLSS CLUB — THE SOCIAL TRAINING NETWORK

The club should become a central product pillar, not an afterthought.

Build an environment where people connect through what they train, what they are learning, and the goals they are pursuing.

### Social feed

Support:

- Completed activities.
- Workout recaps.
- Personal milestones.
- Progress updates.
- Training plans and useful educational content.
- Club announcements.
- Event invitations.
- Coaching insights.
- Comments, reactions, and supportive interactions.

Prioritize training-related content over generic lifestyle posts.

Provide meaningful controls over who can see, comment on, or share an activity.

### Clubs

Allow users to create or join:

- Running clubs.
- Gym communities.
- BJJ academies.
- Taekwondo schools.
- Krav Maga training groups.
- Basketball teams.
- Pickleball groups.
- University athletic communities.
- General multi-sport clubs.

Club capabilities:

- Member profiles.
- Scheduled sessions.
- Group challenges.
- Club activity feeds.
- Events and attendance.
- Shared goals.
- Optional leaderboards.
- Coach or organizer roles.
- Club-level privacy settings.

### Local discovery

Where location permissions and reliable data are available, let users discover nearby clubs, public sessions, events, courts, gyms, and training opportunities.

Never publish a user's precise location or live training route without explicit consent.

### Training partners

Let people find compatible partners based on:

- Sport.
- Experience level.
- Preferred training times.
- Goals.
- Approximate area.
- Club membership.
- Preferred training format.

Require appropriate privacy controls and provide reporting and blocking tools.

### Challenges and events

Create:

- Club challenges.
- Individual milestones.
- Distance or activity challenges.
- Consistency goals.
- Team participation events.
- Sport-specific competitions.
- Seasonal community events.

Leaderboards should be configurable, transparent, and appropriate to the sport. Avoid rewarding unsafe training volume or allowing users to manipulate scores through duplicate or invalid activities.

## 9. PRODUCT-LED GROWTH: MAKE USERS WANT TO SHARE LMTLSS

Do not rely exclusively on paid advertising. Build organic distribution into genuinely useful product features.

The guiding principle is:

**Give users a reason to share their achievement, a way for others to understand it, and a low-friction path to join.**

### Growth mechanism 1 — Shareable achievements

Create attractive cards for:

- First run.
- New personal best.
- Completed training program.
- First month of consistent training.
- New martial arts rank, when confirmed by the user or an authorized source.
- Completed race.
- Club milestone.
- Training streak.
- Meaningful improvement within a selected sport.

Avoid exaggerated praise or fabricated accomplishments.

### Growth mechanism 2 — Invite a training partner

Allow users to invite a friend to:

- Join a challenge.
- Attend a club session.
- Compare selected performance metrics.
- Follow a public training profile.
- Start a shared program.

Make invitations easy to send and easy to decline.

### Growth mechanism 3 — Club-led acquisition

Provide clubs with useful tools that encourage them to invite members.

Examples:

- Branded club pages.
- Group training calendars.
- Activity recaps.
- Club challenges.
- Event registration.
- New-member onboarding.
- Optional coach feedback and progress summaries.

Each club can become a distribution channel because members have a concrete reason to join the same platform.

### Growth mechanism 4 — Public athlete profiles

Allow users to create optional public profiles with selected activities and achievements.

Profiles should be shareable through stable web links and useful to people who have not installed the app.

Where technically supported, public pages should load quickly, display well on mobile, and provide an unobtrusive path to sign up.

### Growth mechanism 5 — Referral system

Build an auditable referral system with:

- Unique referral links.
- Attribution windows.
- Install and signup tracking where supported.
- Fraud prevention.
- Clear eligibility rules.
- Optional, disclosed rewards.
- Referral performance analytics.

Do not use deceptive attribution, spam, forced invitations, or undisclosed incentives.

### Growth mechanism 6 — Club identity

Let clubs have their own identity inside LMTLSS while preserving the core product brand.

A club should be able to share an event, weekly recap, or collective achievement with consistent LMTLSS styling.

### Growth mechanism 7 — Social proof through real progress

Highlight authentic achievements and community participation with permission.

Never manufacture testimonials, users, reviews, activity numbers, or success stories.

## 10. THE AI ARCHITECTURE

AI should power decisions where context, adaptation, explanation, and language understanding provide real value.

Do not use an LLM for every calculation. Use deterministic software for exact calculations and AI for tasks that benefit from reasoning or personalization.

### AI subsystem A — Athlete Context Engine

Maintain a structured representation of the user's:

- Goals.
- Selected sports.
- Training experience.
- Available schedule.
- Equipment and facilities.
- Completed activities.
- Preferences.
- Reported recovery and fatigue.
- Relevant constraints.
- Confirmed progress.

Use explicit data provenance and timestamps. Distinguish user-reported facts, imported records, estimates, and AI-generated suggestions.

### AI subsystem B — Sport Router

Route each request to the appropriate sport-specific logic and available tools.

For example:

- A request about running pace goes to the endurance subsystem.
- A hypertrophy programming question goes to the strength subsystem.
- A BJJ drilling question goes to the grappling subsystem.
- A basketball shooting session goes to the basketball subsystem.

A shared AI interface may coordinate these systems, but it must not erase sport-specific logic.

### AI subsystem C — Training Plan Generator

Generate plans from structured inputs.

Requirements:

- Use validated programming rules and domain-specific constraints.
- Account for experience, schedule, goals, and available equipment.
- Produce structured plans that can be saved and edited.
- Explain the purpose of each session.
- Validate the output before presenting it.
- Avoid unsafe increases in training demand.
- Adapt future sessions based on actual data.

### AI subsystem D — Session Adaptation Engine

When a user reports fatigue, misses a session, or lacks equipment:

- Evaluate the context.
- Determine whether adaptation is warranted.
- Suggest appropriate alternatives.
- Explain trade-offs.
- Preserve the user's overall objective.
- Record approved changes.

Do not automatically increase training intensity because the user missed a workout.

### AI subsystem E — Performance Analyst

Analyze longitudinal training records.

Tasks:

- Detect meaningful trends.
- Summarize progress.
- Identify possible plateaus.
- Compare like-for-like activities.
- Explain data limitations.
- Suggest reasonable next steps.

Use statistical methods and deterministic calculations for metrics. Use AI to interpret and communicate results.

### AI subsystem F — Conversational Coach

Provide a natural-language interface for:

- Training questions.
- Program explanations.
- Exercise substitutions.
- Activity analysis.
- Session planning.
- Progress summaries.
- Sport-specific education.

Use retrieval from curated, credible sources where appropriate. Clearly distinguish evidence, established programming rules, estimates, and uncertainty.

### AI subsystem G — Technique and Learning Assistant

Help users organize learning through:

- Exercise instructions.
- Technique checklists.
- Structured skill progressions.
- Training notes.
- Coach-provided feedback.
- Educational video references where available and licensed.

Do not claim that the system can accurately assess a user's physical technique from a video unless the relevant capability has been implemented and validated.

### AI subsystem H — Nutrition Assistant

Support practical meal planning, food logging, and general nutrition education.

Use validated nutrition data sources where available. Clearly identify estimates and account for dietary preferences and restrictions.

Avoid extreme dietary prescriptions, unsafe weight-control guidance, or unsupported medical claims.

### AI subsystem I — Community Assistant

Help users:

- Find relevant clubs.
- Discover compatible events.
- Summarize their own training activity.
- Draft optional activity captions.
- Create club announcements.
- Organize group challenges.

Do not generate fake community engagement or post content without authorization.

### AI subsystem J — Safety and Quality Layer

Validate outputs for:

- Unsupported claims.
- Missing context.
- Contradictory recommendations.
- Unsafe training progressions.
- Privacy violations.
- Data integrity errors.
- Inappropriate medical advice.
- Sport-specific constraints.

Use deterministic guardrails wherever possible and escalate situations that require a qualified professional.

## 11. AI IMPLEMENTATION PRIORITY

Prioritize AI by actual user value.

**Tier 1 — Essential**

- Personalized plan generation.
- Natural-language training assistant.
- Sport-aware exercise or session substitutions.
- Performance summaries.
- Context-aware training adjustments.

**Tier 2 — Differentiating**

- Cross-sport calendar coordination.
- Longitudinal performance insights.
- Adaptive training recommendations.
- Club and event discovery assistance.
- Personalized educational pathways.

**Tier 3 — Advanced, validation-dependent**

- Video-based technique analysis.
- Computer-vision movement feedback.
- Predictive performance modeling.
- More advanced physiological and training-load models.

Do not make Tier 3 capabilities a prerequisite for launching a useful product.

## 12. THE UNIFIED DATA MODEL

Use a shared core with sport-specific extensions.

Core entities:

- User.
- Athlete profile.
- Sport.
- Sport discipline.
- Training plan.
- Scheduled session.
- Completed activity.
- Activity metrics.
- Goal.
- Personal record.
- Progress snapshot.
- Recovery entry.
- Nutrition entry.
- Club.
- Team.
- Training partner relationship.
- Event.
- Challenge.
- Social post.
- Comment and reaction.
- Share artifact.
- Referral.
- AI recommendation.
- External integration.
- Consent and privacy settings.

Sport-specific modules may introduce their own entities, such as:

- Exercise, set, and load.
- Route, split, and interval.
- Martial arts technique and rank.
- BJJ position and drilling session.
- Basketball practice and game statistics.
- Pickleball match and score.

Do not put every possible field into one enormous activity table. Use validated schemas, typed metrics, and clear module boundaries.

Every imported metric must identify its source. Every derived metric must have a documented calculation. Every AI recommendation must retain enough context to explain what it was based on.

## 13. PRODUCT ARCHITECTURE AND UX

Primary navigation:

1. Home.
2. Train.
3. Club.
4. Progress.
5. Profile.

Place the AI coach in an easily accessible position across the product.

The home screen should adapt to the user's sports, training schedule, and current goals.

A runner should see useful running information. A lifter should see their upcoming workout and recent performance. A BJJ athlete should see relevant sessions and technical-development goals.

Multi-sport users should receive a unified view without losing the details of their individual disciplines.

Design the app mobile-first, with responsive web support for richer analytics, coaching tools, and club administration.

## 14. MONETIZATION ARCHITECTURE

Design monetization around sustained user value.

Potential products:

- Free core training and activity logging.
- Premium AI coaching.
- Advanced performance analytics.
- Specialized sport programs.
- Paid expert-created plans.
- Club and coach tools.
- Team management.
- Optional coaching marketplaces.
- Premium integrations where justified.

Do not make basic activity ownership or essential privacy controls dependent on an expensive subscription.

Validate willingness to pay before building every monetization path.

## 15. ENGINEERING WORKFLOW

Before implementing a module:

1. Define the target user and use cases.
2. Write the sport specification.
3. Define the data model.
4. Map every screen and interaction.
5. Define AI responsibilities and deterministic logic.
6. Identify integrations and dependencies.
7. Establish privacy and safety requirements.
8. Define acceptance criteria.
9. Implement the complete vertical workflow.
10. Test against real user scenarios.
11. Validate usability with practitioners of that sport.
12. Release only when core functionality is reliable.

Maintain a product capability matrix indicating whether each sport and feature is planned, in development, implemented, tested, or production-ready.

Never represent planned functionality as available.

## 16. FINAL PRODUCT STANDARD

LMTLSS succeeds when:

- Each sport feels purpose-built.
- Users can train without fighting the interface.
- AI recommendations are useful and explainable.
- Progress is grounded in actual data.
- Multi-sport training feels unified.
- Clubs have practical reasons to organize through LMTLSS.
- Sharing is attractive, optional, and authentic.
- New users can understand the product immediately.
- The black-and-green design system is recognizable throughout.
- New sports can be added without rebuilding the entire platform.

Build a durable, modular athletic ecosystem rather than a feature-heavy prototype.

**LMTLSS is where athletes train, improve, connect, and represent who they are becoming.**

---

## The part that matters most: how to engineer every sport

I would make the product builder follow a repeatable process rather than simply asking an AI to “add Taekwondo” or “add pickleball.”

### 1. Define the sport

Practitioners, goals, terminology, training methodology

### 2. Model the data

Sport-specific entities, metrics, history, validation

### 3. Design the experience

Onboarding, sessions, logging, analysis, sharing

### 4. Add intelligence

Sport-specific AI, deterministic calculations, safety checks

### 5. Validate with athletes

Practitioner feedback, acceptance tests, real-world usability

This is how you avoid having 30 sports that technically exist in the menu but only two that are genuinely usable.

## What I would prioritize for organic growth

[Run Boost - Running App Concept by Danrley Augusto Meurer on Dribbble](https://images.openai.com/static-rsc-4/fywLilaQ5SK_F5HN4w92K16UqICQMHDw2elgik4LaXc8dnNFLqJb24A8MljbMQOnWlOJ9g85wxVSsPfzuoZVyXSa2uJeon7sMT4nk85UXomxuS9tW7QuF-F0m4s2wxE3X_-m5Rif9lgV3JZ7dJqOiTJHaPmBNasSHmaF90Gmyyc?purpose=inline)

1. Shareable performance cards

Every run, workout milestone, or achievement can produce a polished image. The user shares because it represents their progress, and the LMTLSS identity travels with it.

[Sports Event : Schools Team App by Caliber design on Dribbble](https://images.openai.com/static-rsc-4/QXdCZV_u8ta08LVQCVcL9m8YlbKXlBa6KCvUAzHi2QNK9yDJKLnB3QWiK5r-H6T-nREp6woepsfy7MQAkQKuU530fIpvAYdWRV8MalUycW8L2yTDo6oDuBH4L9PNjyKOCYbRxepcKYxlp_pat4vAolAMOpqOT8LiM0Byoxx7zoU?purpose=inline)

2. Club onboarding

A gym, running club, or martial arts academy invites its members into one shared space. That gives people a reason to join together instead of asking everyone to download another isolated tracker.

[Motion - Social Running App for Clubs & Runners](https://images.openai.com/static-rsc-4/0vNmCuIyZokfrjkT8_fiQea_x_EILgOci_CCAVDu9UJ_Tdj8-xAFc8D5ozZcpjvK3lw_u_4jtccFBZmZPjmnbv2aijGkklcLI29BN1-6VbbgV6-c6LGBxjIZiy2GvvwFRZO2wkLosFxKa0NUbUXCLX2Fo_1JEq5C4v1Ls8aDlv0?purpose=inline)

3. The athlete profile

Make a person's athletic development worth showing: sports practiced, selected achievements, progress, club affiliation, and personal milestones. Let users control what is visible.

Measure this growth through the percentage of active users who share an artifact, invitations accepted, club activation, referred-user retention, and the number of new users who complete their first meaningful activity. Downloads alone are not enough.

## My recommended build order

| Phase | What to build |
| --- | --- |
| 1. Foundation | Design system, authentication, athlete profiles, data architecture, privacy |
| 2. Core training | Strength and muscle development, running, workout history |
| 3. Social identity | Activity cards, athlete profiles, clubs, challenges, invitations |
| 4. AI coaching | Training plans, substitutions, progress summaries, adaptive scheduling |
| 5. Martial arts | BJJ, Taekwondo, Krav Maga, followed by additional disciplines |
| 6. Court and team sports | Basketball, pickleball, tennis, football, and others |
| 7. Connected ecosystem | Wearables, advanced analytics, coach tools, more sports |

The underlying architecture should support all these disciplines from the start, even though the interfaces and training systems roll out in stages.

The strategic objective: LMTLSS should become the place where someone manages their athletic development, finds their people, and shares their progress—not merely a place where they record a workout.

---

## Addendum — UI direction: what the product should feel like

*(From the original LMTLSS brief; visual references, not final product screens.)*

**01. Home — your daily performance**

A black canvas, restrained green highlights, a clear training recommendation, the next session, and a compact view of progress. No wall of statistics.

**02. Train — fast and focused**

Large readable numbers, fast logging, one obvious action, and workout controls designed to work while the user is exercising.

**03. Progress — insights, not just data**

Elegant charts, personal records, performance trends, and explanations of what has changed and what to do next.

### Three decisions to make before building

1. **Start with two excellent sports, not 20 mediocre ones.** Build strength training and running as the initial experiences, with an architecture that can support other disciplines. This tests whether the unified platform works before expanding.
2. **Make the differentiator the unified training intelligence.** Plenty of apps record workouts. LMTLSS should understand how a person's different activities fit together and help them make better training decisions.
3. **Treat green as a functional color.** Use #61EB1A for actions, active states, and meaningful progress. Keep most of the interface black and neutral. That will feel more premium than making every card glow green.

### Positioning

**LMTLSS — the operating system for human performance.** Broad enough to encompass every sport while giving the product a clear identity beyond being another workout tracker.

---

## Addendum — Advanced Platform Systems and Product Quality

*(From "What I would implement next" — the prompt section explicitly intended for this brief.)*

Extend the existing LMTLSS architecture with the following mandatory capabilities.

### A. Athlete Operating System

Create a unified athlete context that coordinates training plans, activity history, goals, availability, and sport-specific records. Support multi-sport scheduling and explainable recommendations without merging unrelated performance metrics.

### B. Modular Sport Framework

Implement sports as independent, validated modules using shared platform services. Each module must define its domain model, athlete profile, workflows, metrics, AI tasks, safety constraints, and acceptance tests.

### C. Progression Engine

Distinguish completed activities, measured performance, long-term development, and suggested actions. Produce sport-specific progress summaries and editable next milestones grounded in available data.

### D. Club and Social Graph

Model athletes, clubs, teams, events, training partners, challenges, and membership permissions. Support privacy controls, invitations, moderation, and club-level administration.

### E. Activity-to-Content Engine

Generate original, customizable, accurate share cards from validated activity data. Support native mobile sharing, optional public web previews, and privacy-aware referral attribution.

### F. Data Interoperability

Support import, export, deduplication, synchronization, and source provenance. Implement integrations only after verifying permissions, provider APIs, and supported data types.

### G. AI Evaluation and Observability

Maintain versioned evaluations for each AI capability. Validate structured outputs, measure accuracy and usefulness, monitor latency and cost, and maintain deterministic fallbacks for essential operations.

### H. Privacy and Safety

Enforce access controls, data minimization, consent, deletion, export, route privacy, age-appropriate controls, reporting, and blocking. Protect sensitive information throughout the mobile client, backend, analytics, and AI pipeline.

### I. Commercial Architecture

Prepare for subscriptions, club plans, expert-created programs, and coaching services through modular entitlements and payment interfaces. Implement commercial features only after validating demand and applicable platform requirements.

### J. Product Analytics

Instrument the complete user journey, including activation, repeat activity, retention, recommendation adoption, referrals, club participation, subscription conversion, and reliability. Use aggregate reporting and privacy-preserving analytics where possible.

### K. Product Builder

Establish a repeatable engineering workflow for new sport modules. Generate specifications before implementation, reuse established components, create tests and migrations, review changes, and verify regression safety.

### Acceptance criteria

Every capability must have documented ownership, data requirements, permissions, failure behavior, tests, and measurable completion criteria.

No feature is considered complete because a screen exists. It is complete when its underlying behavior works, its data is reliable, its permissions are correct, and its user journey has been tested on supported platforms.

---

## Addendum — Activity Tracking, Clubs, Events, and Sharing Engineering Specification

*(From the owner's "Activity Tracking, Clubs, Events, and Sharing" specification — additional engineering requirements for the app builder.)*

Implement the following connected product systems within the existing LMTLSS architecture. Build working features, not static UI demonstrations.

### 1. Activity Recording Service

Implement a mobile activity-recording service with a shared interface and platform-specific implementations where necessary.

For running:

- Start, pause, resume, and finish recording.
- Collect timestamped GPS coordinates when permission is granted.
- Persist session state locally.
- Support background tracking using platform-compliant mechanisms.
- Calculate distance, duration, pace, splits, and elevation where supported.
- Filter invalid or noisy GPS points.
- Handle permission denial, weak GPS, app suspension, battery constraints, and interrupted sessions.
- Synchronize completed activities safely.
- Prevent duplicate activity records.
- Clearly distinguish recorded, estimated, and unavailable metrics.
- Test on physical iOS and Android devices.

### 2. Route Visualization

Use a licensed mapping solution with a documented integration interface.

Display actual recorded coordinates, route bounds, start and finish markers where appropriate, and supported activity statistics.

Support route privacy, optional masking of sensitive locations, and controls for public visibility.

Never fabricate routes or display a map as recorded activity when no corresponding GPS data exists.

### 3. Share Studio

Implement a dedicated activity-sharing editor.

Support:

- Route cards.
- Strength recaps.
- Personal records.
- Weekly training recaps.
- Multi-sport summaries.
- Club and event achievements.

Generate media from validated activity records using reusable, tested templates.

Support appropriate aspect ratios, previewing, optional captions, selective metric visibility, and native device sharing.

Provide a functional export fallback when third-party sharing is unavailable.

### 4. Third-Party Integrations

Create independent integration adapters for supported external services.

For each integration, document:

- Supported platforms.
- Authentication and permission requirements.
- Available API and SDK capabilities.
- Data types and synchronization direction.
- Rate limits and costs where applicable.
- Error handling.
- Privacy implications.
- Integration tests.
- Unsupported features.

Investigate supported Snapchat, Instagram, mapping, wearable, and fitness-platform capabilities before implementation.

Never promise direct publishing, access to friends, activity synchronization, or other capabilities without verified support.

### 5. Clubs

Implement:

- Club profiles.
- Membership and invitation workflows.
- Public, private, and invitation-only access.
- Member, coach, and administrator permissions.
- Club announcements and activity feeds.
- Group challenges.
- Event creation and attendance.
- Reporting and moderation.
- Club-level activity summaries.

Connect completed activities to club challenges or events only through clear eligibility rules and appropriate user consent.

### 6. Events

Implement a unified events system for LMTLSS-hosted events and external event listings.

Support:

- Event creation and editing.
- Sport, title, description, organizer, location, and time zone.
- Capacity, RSVP, waitlist, and registration status.
- Free and paid event metadata.
- Calendar export.
- Reminders.
- Cancellations and schedule changes.
- External registration links.
- Organizer permissions and verification.
- Event reporting.
- Attendance and check-in where appropriate.

Keep external event imports behind provider-specific adapters. Preserve the source of imported information and do not imply an external partnership.

### 7. Reliability and Security

Use local persistence, safe synchronization, backend validation, access control, monitoring, and regression testing.

Sensitive route and health data must not be exposed by default.

Handle partial failures gracefully. A failure to render a share card must not destroy a completed workout. A failure in a social integration must not prevent the user from recording an activity.

### 8. Acceptance Tests

Verify:

- A run can be recorded, paused, resumed, completed, and saved.
- Activity data survives supported interruptions.
- GPS errors and missing permissions are handled clearly.
- Saved routes display the correct data.
- Share cards use actual activity records.
- Sharing and exporting work on both mobile platforms.
- Club membership and event permissions are enforced.
- RSVP and capacity rules are correct.
- Imported external records retain their provenance.
- Sensitive data respects privacy settings.
- The core experience remains usable offline where supported.

Maintain a capability matrix distinguishing planned, implemented, tested, and production-ready features.

Use the LMTLSS colors #000000 and #61EB1A consistently. Preserve the established premium design system while implementing platform-appropriate mobile interactions.
