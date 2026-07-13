# Waypoint — Design Directions

## Direction 1

**Theme Name**: Cartographer's Desk

**Very Brief Intro**: A refined route-planning workspace inspired by folded field maps, transit diagrams, and editorial travel guides. Warm paper neutrals on the planning side contrast with a cooler, immersive map canvas.

**Probability**: 0.04

## Direction 2

**Theme Name**: Night Dispatch

**Very Brief Intro**: A dense, dark operations interface with bright route signals, compact controls, and a professional logistics feel. It prioritizes rapid scanning over leisurely exploration.

**Probability**: 0.07

## Direction 3

**Theme Name**: Coastal Atlas

**Very Brief Intro**: A bright, airy travel-planning interface built around ocean blues, soft sand tones, and oversized destination photography. It feels optimistic and recreational.

**Probability**: 0.03

## Chosen Approach: Cartographer's Desk

### Design Movement

The interface draws from **Swiss cartographic modernism** and contemporary editorial travel publishing: precise information hierarchy, restrained geometry, tactile paper color, and one assertive signal color.

### Core Principles

1. **Map first, controls second**: the map remains the dominant spatial object while the planner reads as a focused workbench rather than a generic dashboard.
2. **Information as wayfinding**: labels, numbering, connecting lines, and selected states should make the user's next action obvious without decorative clutter.
3. **Tactile restraint**: soft paper tones, subtle grain, fine rules, and compact shadows create depth without glassmorphism or excessive rounded cards.
4. **Asymmetric utility**: a strict half-and-half desktop split gives way to a bottom-sheet map relationship on mobile.

### Color Philosophy

The planner uses warm **paper ivory** to reduce the sterile feel of typical map products, paired with deep ink for trust and legibility. The map and data overlays lean cool so the route itself reads clearly. A vivid vermilion-orange is reserved for active waypoints and primary actions, behaving like a cartographer's marking pencil.

### Layout Paradigm

Desktop uses two equal vertical territories: a scrollable planner workbench on the left and an edge-to-edge map canvas on the right. Within the planner, content follows a vertical route spine rather than a centered grid. Mobile becomes a map-first stack with the planner as the natural document flow and a sticky route summary.

### Signature Elements

1. A continuous **route spine** that runs through numbered destination markers.
2. **Cut-corner labels** and compact coordinate-style metadata that evoke map legends.
3. Fine **topographic contour texture** used sparingly in headers and empty states.

### Interaction Philosophy

Actions should feel like editing a physical itinerary: destination rows lift slightly when active, dragged stops move with tight spring motion, and map selections immediately echo in the planner. High-frequency actions stay fast and quiet; larger state changes use short directional motion.

### Animation

Use 140–220 ms transitions with a snappy cubic-bezier easing. Destination additions enter with a subtle 10 px upward translation and opacity fade. Selected route markers pulse once, never continuously. Drawers and recommendation panels move along the axis from which they originate. All non-essential motion is disabled for reduced-motion preferences.

### Typography System

Use **DM Sans** for functional UI text because of its compact readability, paired with **Newsreader** italic for destination moments and editorial accents. Route titles use DM Sans at 700–800 weight with tight tracking; place names use 600; metadata uses uppercase DM Sans at 11–12 px with widened tracking. Newsreader is reserved for human, exploratory language rather than controls.

### Brand Essence

**Waypoint turns complex, many-stop journeys into a clear visual story for travelers and field planners who have outgrown basic directions.** Personality: **precise, curious, composed**.

### Brand Voice

Headlines are concise and assured. CTAs use direct verbs. Microcopy is calm and spatially aware, avoiding generic product language.

Example lines: **"Put every stop on the same page."** and **"Find a better order."**

### Wordmark & Logo

The wordmark pairs a custom heavy "Way" with a lighter "point," accompanied by a bold symbol: three offset route nodes connected into a folded-path "W." The mark must remain recognizable at favicon scale and never rely on default-font text alone.

### Signature Brand Color

**Signal Vermilion — `#F05A3C`**. It marks the current stop, the active route, and decisive actions.

## Style Decisions

All planner controls use cartographic geometry first: cut corners, fine-rule borders, legend labels, and compact stamped states are preferred over generic rounded dashboard cards.

The Waypoint wordmark visibly contrasts a heavy **Way** with a lighter **point**, paired with the route-node W symbol as the recurring brand mark.

Signal Vermilion `#F05A3C` remains reserved for active waypoints, route state, and primary route decisions; secondary interface elements stay in ink, paper, and muted map tones.

