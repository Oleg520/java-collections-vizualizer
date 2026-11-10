# Floating Playback Dock — PR #64

Chromium, production preview, DPR 1. Desktop: 1440×900, HashMap tree scenario;
mobile: 412×839, first ArrayList add. Each pair shows the page end and the same
paused trace and cursor before and after collapse. These are browser-emulation
captures, not photos from a physical phone.

| Viewport | Expanded | Collapsed |
|---|---|---|
| Desktop | [Screenshot](desktop-expanded.png) | [Screenshot](desktop-collapsed.png) |
| Desktop, short ArrayList | [Screenshot](desktop-short-expanded.png) | [Screenshot](desktop-short-collapsed.png) |
| Mobile | [Screenshot](mobile-expanded.png) | [Screenshot](mobile-collapsed.png) |

At 1440×900, page-height measurements before/after moving clearance to the
overlapped column and letting Events use its content height:

| State | Before | After |
|---|---:|---:|
| Empty ArrayList, expanded | 1413px | 1295px |
| First add, expanded | 1428px | 1295px |
| First add, collapsed | 1344px | 1295px |
| HashMap tree, expanded | 1509px | 1509px |

The tree still needs its scroll reserve. On short scenarios the sidebar's natural
scenario list can determine page height; independent sidebar scrolling remains #59.
There is no additional dock-height padding below the desktop inspector.

Automated behavior coverage and the focused command are described in
[TESTING.md](../../TESTING.md#постоянное-управление-воспроизведением).
