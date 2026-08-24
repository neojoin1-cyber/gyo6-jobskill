**Design QA**

- Source visual truth: `C:/Users/kbe/AppData/Local/Temp/codex-clipboard-bca8067f-8bcb-45a4-afef-146be1ec2d84.png` (371 x 941), `C:/Users/kbe/AppData/Local/Temp/codex-clipboard-fe527705-95ba-4d40-845d-26a45affc497.png` (375 x 947)
- Rendered implementation: `D:/apps/sugar-salt-campus/output/design-qa/teacher-mobile.png` (295 x 637), `D:/apps/sugar-salt-campus/output/design-qa/teacher-wide.png` (968 x 585)
- Combined full-view evidence: `D:/apps/sugar-salt-campus/output/design-qa/compare-old-new-mobile.png`
- Focused header evidence: `D:/apps/sugar-salt-campus/output/design-qa/compare-header.png`
- Viewport/density normalization: browser content capture at device scale 1. The 371 px source was resized to 295 px wide and cropped to the same 637 px visible height before comparison. The wide implementation was reviewed separately at 968 x 585.
- State: authenticated demo teacher, assigned class (`체험 1반`), light theme, teacher dashboard.

**Findings**

- No actionable P0/P1/P2 visual differences remain against the requested redesign direction.
- Typography: compact Korean UI hierarchy is readable; display text, labels, and small metadata have distinct weights without negative letter spacing or viewport-scaled fonts.
- Spacing/layout: the former crowded two-row control header is replaced by a stable compact shell. Mobile has five persistent task tabs; wide mode retains the left work rail and uses the content width for class signals.
- Colors/tokens: student campus blue, green progress, red unresolved-answer, and amber attention states are used semantically. Contrast remains clear on the light surface.
- Image quality: the real campus WebP asset is sharp, correctly cropped, and supports the learning context without replacing content. No placeholder or CSS-drawn visual is used.
- Copy/content: teacher actions are task-oriented (`학생 화면 그대로 보기`, `수업 시작`, `자소서 첨삭`, `로그아웃`). The dashboard leads with current class activity and actionable coaching signals.
- Responsive behavior: no horizontal overflow or clipped persistent navigation was observed in mobile and wide captures.

**Comparison History**

- Earlier P1: mobile header exposed ambiguous `자동 맞춤/넓게` controls, crowded the account area, and made logout appear absent. Fixed with a compact shell, icon actions, and an account popover containing an explicit logout command. Post-fix evidence: `compare-header.png`.
- Earlier P1: teacher home prioritized empty or disabled management tiles and did not expose the student learning experience. Fixed with a student-view entry, live class summary, smart brief, five teacher task tabs, and the complete student campus preview. Post-fix evidence: `compare-old-new-mobile.png` and `teacher-wide.png`.
- Earlier P2: browser-only learning image paths failed under the Node release audit. Fixed with a safe base-path fallback; the full production build and learning-experience gate now pass.

**Primary Interactions Tested**

- Account menu open and explicit logout to role selection.
- Teacher login restored after logout.
- Student campus preview open, all five student tabs present, and `나` screen reached.
- NCS hall opened through learning mode selection.
- Teacher return control, class teaching studio, student progress, and messaging opened.
- Console logs were checked during the interaction pass; no browser errors were observed.

**Focused Region Review**

- Header was compared separately because account/logout discoverability was the user's highest-risk complaint. The new header preserves the brand and presents three stable actions without wrapped labels.

**Follow-up Polish**

- P3: on exceptionally narrow embedded browser widths, the account trigger intentionally collapses to the teacher's initial. The full teacher name and logout remain visible immediately after opening it.

**Implementation Checklist**

- [x] Teacher can use the complete student learning campus.
- [x] Teaching, student management, communication, and cover-letter review remain available as teacher bonuses.
- [x] Mobile and wide layouts verified.
- [x] Logout verified end to end.
- [x] Production release gates and build passed.

final result: passed
