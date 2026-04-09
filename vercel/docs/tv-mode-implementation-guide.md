# TV Mode Implementation Guide

This document is the working guide for turning the WEBTVBD client into a proper Smart TV experience without breaking the current mobile, desktop, and laptop UI.

## Goal

Build a dedicated TV interaction mode that:

- works smoothly with remote controls and keyboard arrows
- follows a Netflix / Prime Video style "10-foot UI"
- keeps the current mobile and desktop experiences intact
- can be rolled out in phases without rewriting the entire app at once

## Non-Goals

- do not replace the existing mobile UI
- do not replace the existing desktop UI
- do not mix touch-first patterns into TV mode
- do not rely on hover interactions in TV mode

## Current Integration Points

The current app already has good entry points for a TV rollout:

- `components/iptv/IptvHomeClient.js`
  Main client shell for TV + Movies.
- `components/iptv/LeftSidebar.js`
  Category / mode navigation entry point.
- `components/iptv/TopNavbar.js`
  Header actions and top-level controls.
- `components/iptv/VideoPlayer.js`
  Live TV playback controls and fullscreen flow.
- `components/movies/MoviesView.js`
  Movie browse + movie watch UI.
- `components/iptv/iptv.module.css`
  Shared shell styles where TV-only variants can be attached.
- `components/movies/movies.module.css`
  Movie-specific styles where TV layouts can be layered in.

There is also existing state that helps:

- `isTvDevice`
- `forceTvMode`
- `homeMode`
- `movieViewMode`

## Product Direction

TV mode should be a parallel interaction layer, not a separate app.

Recommended strategy:

1. keep current routes the same
2. detect TV mode in the client shell
3. add TV-specific classes and focus behavior
4. swap layout and interactions only when TV mode is active

This keeps the rollout controlled and low-risk.

## Core TV Principles

### 1. Focus-first, not click-first

Every interactive element must be reachable with:

- `ArrowUp`
- `ArrowDown`
- `ArrowLeft`
- `ArrowRight`
- `Enter`
- `Backspace` / `Escape`

### 2. No hover dependency

Any control that is only visible on hover must have a focus-visible alternative in TV mode.

### 3. Big targets

All TV mode controls should have:

- larger hit areas
- larger text
- stronger focus state
- larger spacing between items

### 4. Low cognitive load

TV mode should minimize:

- tiny pills
- dense forms
- multi-row micro-actions
- hidden mobile-only drawers

## Phase Plan

## Phase 1: TV Foundation

Objective:
Enable reliable TV detection and remote-safe focus infrastructure.

Tasks:

- add a stable TV mode detector
- keep manual override for debugging
- attach a `tv-mode` class to the document or app shell
- add a reusable focus system:
  - focus scope
  - focus item registration
  - directional movement
  - restore previous focus
- create strong TV focus styling token(s)
- map remote keys to navigation behavior

Deliverable:
The app can be navigated with remote / keyboard in a basic but stable way.

## Phase 2: TV Shell

Objective:
Make the shell feel TV-native.

Tasks:

- adapt `TopNavbar` for TV:
  - larger actions
  - simpler spacing
  - clearer focused state
- adapt `LeftSidebar` into TV-friendly navigation:
  - either collapsible rail or focus-open panel
- ensure overlays and menus trap focus correctly
- preserve desktop/mobile behavior as-is

Deliverable:
Main shell works as a remote-navigable TV app.

## Phase 3: Movie Browse TV Mode

Objective:
Replace dense browse UI with TV-friendly browsing.

Tasks:

- create TV-specific movie browse layout
- prefer rails or large-card grid
- reduce visible filter density
- replace pagination-heavy behavior with:
  - focus-safe paging, or
  - progressive loading / continuation
- make search a full TV overlay
- make filter selection a TV panel, not chip wall
- ensure focus restore when returning from single movie page

Deliverable:
Movie browsing feels like Netflix / Prime style browsing.

Status:

- TV browse now has a featured hero section
- TV browse now renders horizontal movie rails instead of relying only on dense grid + pagination
- rails currently include continue watching, favorites, top rated, recent releases, and top genres
- TV browse now has a dedicated TV search overlay with its own focus scope, clear action, and live result list
- TV browse now has a dedicated TV filter overlay with its own focus scope and quick mode/category/genre/language/year controls
- rails now include smarter recommendation-style sections such as "Because You Watched This" and language-based continuation
- remaining work is deeper recommendation logic and richer TV-only query suggestions

## Phase 4: Single Movie Page TV Mode

Objective:
Turn the movie detail/watch page into a remote-first layout.

Tasks:

- hero / poster-led presentation
- large CTA row:
  - Play
  - Resume
  - Restart
  - Favorite
- metadata secondary, not primary
- related / recommended row below
- focus order must be predictable
- Back key should return to previous focused movie card

Deliverable:
Single movie page is fully usable with only a remote.

Status:

- movie player CTA row is TV-focusable
- movie detail IMDb outbound link is TV-focusable
- browse/watch movie content now shares one focus scope
- remaining work is TV-specific visual redesign and recommendation rails

## Phase 5: Live TV TV Mode

Objective:
Make live playback and channel browsing feel TV-native.

Tasks:

- fullscreen-first viewing behavior
- focusable playback overlay
- channel list drawer / side panel
- category rail for channels
- remote playback controls:
  - play/pause
  - next/prev channel
  - seek if supported
  - open categories
- idle auto-hide behavior
- safe restore after overlay closes

Deliverable:
Live TV becomes the strongest TV-native part of the app.

Status:

- inline live player controls are TV-focusable
- fullscreen live overlay panels now publish a dedicated focus scope
- fullscreen category list, channel list, favorite toggles, play/stop/nav/mute/volume controls are TV-focusable
- remaining work is richer TV-native overlay layout, stronger focus visuals, and idle-hide polish

## Phase 6: TV Search

Objective:
Make searching usable without a mouse.

Tasks:

- TV search overlay
- on-screen keyboard support path
- query suggestions
- recent searches
- result rows with strong focus states
- fast jump from search result to detail/play

Deliverable:
Search can be used from a remote without frustration.

Status:

- TV search now opens in a dedicated overlay for TV browse mode
- overlay has a dedicated focus scope, clear/close actions, and live search results
- empty-query state now shows suggested movies instead of a dead empty panel
- TV browse now also has a dedicated filter overlay so search and filtering are no longer tied to dense chip walls
- TV search now includes an on-screen keyboard path for remote-first input
- TV search now shows query suggestions and remembers recent searches
- remaining work is richer suggestion ranking and optional full virtual-keyboard polish

## Phase 7: Polish and Reliability

Objective:
Finish the TV experience with production-level polish.

Tasks:

- idle state polish
- transition tuning
- focus restore after route change
- focus restore after player exit
- performance tuning for lower-power TV hardware
- browser + Android TV testing
- keyboard fallback testing

Deliverable:
TV mode feels consistent and production-ready.

## Interaction Model

### Global Keys

- `ArrowUp/Down/Left/Right`
  Move focus
- `Enter`
  Activate focused item
- `Escape` / `Backspace`
  Close overlay or go back
- `Space`
  Optional play/pause shortcut
- media keys if available
  Bind where useful

### Focus Scopes

Recommended scopes:

- top nav
- left nav
- live player controls
- channel categories
- channel list
- continue watching rail
- movie rails / grid
- single movie actions
- search overlay
- filter overlay

### Focus Restore Rules

When the user:

- opens a movie from a rail
  restore focus to that rail item when going back
- opens a channel from the channel list
  restore focus to that channel item when closing
- opens search
  restore focus to the search trigger when closing if no result was chosen

## Visual Guidelines

TV mode should use:

- larger typography
- higher contrast focus rings
- more whitespace
- fewer tiny badges visible at once
- simplified information density

TV-specific focus should be stronger than normal web focus:

- visible ring
- slight scale-up
- elevated shadow
- optional glow using existing brand tokens

## Layout Guidance by Screen

### TV Home

- featured hero
- rails:
  - Continue Watching
  - Live TV
  - Movies by category
  - Favorites
  - Recently Watched

### Movie Browse

- rails or large-card grid
- focus keeps current row centered where possible
- search/filter hidden behind overlays

### Single Movie

- big actions first
- metadata second
- related content rail below

### Live TV

- player dominates screen
- overlays appear on demand
- hide overlays after inactivity

## Technical Rules

- TV mode must be opt-in by detected environment or debug toggle
- desktop and mobile CSS must stay intact unless `tv-mode` is active
- TV interaction code should live in reusable utilities/hooks, not duplicated in each component
- avoid one-off focus hacks in individual screens
- prefer central state for last focused item per area

## Suggested Implementation Order

This is the recommended execution order:

1. TV mode guide and checklist
2. TV detection + root class
3. focus engine + keyboard/remote handler
4. shell integration
5. movie browse TV mode
6. single movie TV mode
7. live TV TV mode
8. TV search overlay
9. polish / QA

## Checklist

- [x] Create TV mode root state and class
- [x] Add remote/keyboard event mapping
- [ ] Add focus registration system
- [x] Add reusable focus ring tokens/styles
- [x] Make top nav TV-safe
- [x] Make left nav TV-safe
- [ ] Build movie browse TV layout
- [ ] Build single movie TV layout
- [ ] Build live TV overlay controls for TV
- [ ] Build TV search overlay
- [ ] Add focus restore rules
- [ ] Add inactivity hide behavior
- [ ] Test on browser keyboard
- [ ] Test on Android TV / TV browser where possible

## Notes

- Current mobile search/filter drawer work is not the TV solution.
- TV mode should not depend on the current mobile drawer UX.
- The current shell is strong enough to support a phased TV rollout without a full rewrite.

## Status

Guide created and phase 1 foundation has started.

Implemented in phase 1 so far:

- persisted manual TV mode override
- stronger Smart TV user-agent detection
- root `tv-mode` class attached to document and app shell
- central remote/keyboard event mapping for arrows, select, back, home, media next/prev
- reusable TV focus ring styling tokens and larger interaction minimums
- shell focus scopes for top nav, left nav, and right panel
- focus restore when left/right drawers open and close
- TV-focusable shell actions in top nav dropdowns and side panels
- TV-focusable targets added for movie cards, browse pagination, continue watching pagination, mobile search results, and single-movie action buttons

Still remaining before phase 1 is complete:

- reusable focus registration / focus scope system
- restore previous focus after overlays and route changes
- deeper content scopes for movie rails, detail panels, and live player overlays
