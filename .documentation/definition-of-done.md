# Definition of Done (DoD)

**Project:** HOPE ERP | **Version:** 0.1 (draft for the team to review)

## 1. Task level
A task (issue) is **Done** only when all of these are true:

- [ ] The work described in the task title is finished.
- [ ] It meets the **acceptance criteria** of the linked user story (the parts this task is responsible for).
- [ ] The work is on its own branch and submitted as **one pull request** that uses the PR template.
- [ ] The PR description contains `Closes #<issue number>`.
- [ ] At least **1 teammate (not the author) has reviewed and approved** the PR, and review comments are resolved.
- [ ] Any automated checks and tests that exist pass.
- [ ] No passwords, tokens or other secrets are in the repository.
- [ ] The PR is **merged into `main`**.
- [ ] The card on the project board is in **Done**.

## 2. Extra checks by type of work

**Code (Developer)**
- [ ] The feature works when run from a clean setup using the README instructions.
- [ ] User-facing text and error messages are clear.
- [ ] Permissions are checked on the **server**, not only hidden in the screen.

**Database (DB Admin)**
- [ ] Changes are made through a **migration script** that can run from scratch and does not break existing data.
- [ ] The setup README is updated if the steps changed.
- [ ] Seed data contains no real passwords.

**Testing (Tester)**
- [ ] Each test case states the steps, the expected result and the actual result.
- [ ] Bugs found are reported as issues with steps to reproduce, and fixes are re-tested.

**Design (UI/UX Designer)**
- [ ] The design follows the shared design system (colors, typography, components).
- [ ] The files are saved where the team can open them (link in the issue or PR).
- [ ] The Developer has the handoff notes they need.

**Documents (everyone)**
- [ ] Written in plain language, checked for spelling, and saved in the `.documentation/` folder.

## 3. User story level
A user story is **Done** only when:

- [ ] All its linked tasks are Done.
- [ ] **Every acceptance criterion** has been checked and passes (the Tester confirms this).
- [ ] There are no open bugs that break the story.
- [ ] It can be demonstrated in the Sprint Review.
- [ ] The Product Owner (or instructor) has accepted it, or has had the chance to.

## 4. Sprint level
A sprint is ready to close when:

- [ ] Every story in the sprint is Done, or the unfinished ones have been discussed and moved on purpose.
- [ ] `main` runs correctly and nothing in it is broken.
- [ ] The Sprint Review and Retrospective have been held and the report is written.
- [ ] Improvement actions from the retrospective have an owner.

## 5. What is not "Done"
These do **not** count as done: "it works on my computer", "I just need to clean it up", "the PR is open", "the code is written but not tested", or "merged without a review".

## 6. Approval
By approving the pull request for this file, each member agrees to follow this Definition of Done.
