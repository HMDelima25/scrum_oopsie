# Role Guide

**Project:** HOPE ERP | **Version:** 0.1 (draft for the team to review)

> A one-page guide to who does what. Roles describe **responsibilities**, not rank. Everyone helps the team reach the sprint goal, and anyone can ask a teammate for help.

## Quick view

| Role | Main job in one sentence | Sprint 1 tasks |
|---|---|---|
| Scrum Master | Helps the team follow the process and removes blockers | S1-SM-01 to S1-SM-05 |
| Developer | Builds the features | S1-DEV-01 to S1-DEV-08 |
| DB Admin | Designs and maintains the database | S1-DBA-01 to S1-DBA-06 |
| Tester | Checks that the work meets the acceptance criteria | S1-TST-01 to S1-TST-06 |
| UI/UX Designer | Designs how the system looks and feels to use | S1-UIX-01 to S1-UIX-05 |
| Product Owner | Decides priorities and accepts the work | (see note below) |

*Product Owner: confirm with the instructor whether this is the instructor, a team member, or shared.*

## Scrum Master
**Purpose:** Help the team work well using Scrum, and keep the process healthy.

**Responsibilities**
- Organize and facilitate Sprint Planning, daily standups, the mid-sprint check, the Sprint Review and the Retrospective.
- Keep the team's agreements (working agreement, Definition of Done) visible and followed.
- Record blockers in the impediment log and follow them until they are resolved.
- Set up and keep the repository, branch protection, templates and project board in order.
- Coach the team: ask questions instead of giving orders, and protect the team from interruptions.

**Not the Scrum Master's job:** assigning work by force, being the "boss", or writing the team's code for them.

## Developer
**Purpose:** Turn user stories into working software.

**Responsibilities**
- Build the features in the sprint, one task per branch and pull request.
- Write clear, readable code and keep the setup instructions working.
- Review teammates' pull requests on time.
- Check permissions on the server, not only in the screen.
- Say early when a task is bigger or harder than expected.

## DB Admin
**Purpose:** Own the database so the system stores and protects data correctly.

**Responsibilities**
- Create and maintain the database structure through migration scripts.
- Prepare seed data and the setup README so any teammate can run the database locally.
- Work with the Developers so the tables match what the features need.
- Make sure changes to data are recorded (for example the audit log).
- Keep passwords and secrets out of the repository.

## Tester
**Purpose:** Give the team confidence that what we build actually works.

**Responsibilities**
- Write the sprint test plan and turn each acceptance criterion into test cases.
- Test finished work, report bugs as issues with clear steps to reproduce, and verify the fixes.
- Confirm when a user story meets all its acceptance criteria.
- Raise unclear or untestable criteria early, before the work is built.

## UI/UX Designer
**Purpose:** Make the system clear and pleasant to use.

**Responsibilities**
- Create and maintain the design system (colors, typography, components).
- Produce wireframes and mockups for the screens in the sprint.
- Give Developers handoff notes so they can build the design as intended.
- Check the finished screens against the design and give feedback.

## Product Owner
**Purpose:** Represent the needs of the people who will use the system.

**Responsibilities**
- Explain the user stories and what is most important.
- Answer questions about requirements quickly.
- Accept or reject finished stories against the acceptance criteria.
- Decide what goes first when there is too much work.

## Everyone, whatever the role
- Come to the team meetings and keep your board cards up to date.
- Review at least your share of pull requests.
- Raise problems early and help teammates who are stuck.
- Follow the working agreement and the Definition of Done.
- Treat each other with respect.
