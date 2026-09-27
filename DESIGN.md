---
name: "Showcam"
description: "Rounded smoked glass for clear scene inspection and precise controls."
colors:
  canvas: "#131615"
  surface: "#202522"
  surface-raised: "#2b312d"
  text: "#f5f4ed"
  text-secondary: "#c1c6bd"
  text-muted: "#a7afa4"
  viewer-text-secondary: "#e1e6de"
  viewer-text-muted: "#d6ded2"
  accent: "#edc58c"
  accent-hover: "#f5d5a8"
  on-accent: "#292317"
  selection: "rgb(237 197 140 / 14%)"
  success: "#afceaf"
  danger: "#f4aaa4"
  border: "rgb(245 244 237 / 14%)"
  border-strong: "rgb(245 244 237 / 27%)"
  surface-glass-light: "rgb(10 18 15 / 60%)"
  surface-glass-default: "rgb(10 18 15 / 64%)"
  surface-glass-dense: "rgb(10 18 15 / 72%)"
typography:
  display:
    fontFamily: "'Manrope Variable', sans-serif"
    fontSize: "3.5rem"
    fontWeight: 500
    lineHeight: "1.1"
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "'Manrope Variable', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: "1.25"
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Manrope Variable', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.4"
  body:
    fontFamily: "'Manrope Variable', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.55"
  label:
    fontFamily: "'Manrope Variable', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1.55"
  code:
    fontFamily: "'SFMono-Regular', Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1.5"
rounded:
  xs: "6px"
  sm: "10px"
  control: "12px"
  md: "16px"
  panel: "24px"
  stage: "28px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-10: "40px"
  space-12: "48px"
  space-16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  button-danger:
    backgroundColor: "rgb(244 170 164 / 8%)"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  viewer-button-secondary:
    backgroundColor: "rgb(10 18 15 / 28%)"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  viewer-button-secondary-hover:
    backgroundColor: "rgb(10 18 15 / 48%)"
  viewer-segment-selected:
    backgroundColor: "rgb(245 244 237 / 16%)"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  text-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  badge-accent:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.accent}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  glass-panel-light:
    backgroundColor: "{colors.surface-glass-light}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  glass-panel-default:
    backgroundColor: "{colors.surface-glass-default}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  glass-panel-dense:
    backgroundColor: "{colors.surface-glass-dense}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  segmented-control:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "4px"
  section-navigation:
    textColor: "{colors.text-secondary}"
    rounded: "8px"
    padding: "10px 12px"
  toggle:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.pill}"
    width: "38px"
    height: "23px"
---

# Design System: Showcam

## Overview

**Creative North Star: "The director’s light table"**

Showcam places readable, rounded controls over scene imagery. Smoked charcoal glass, warm white Manrope, and amber selection create a quiet working environment with enough definition for precise inspection. Brighter inset highlight rims and soft downward shadows distinguish the interface from the scene. The live viewer fills the window, with its controls floating directly over the 3D canvas.

Density follows the information: brief overlays can remain translucent, while timelines and sustained reading use more opaque surfaces. This visual system is independent of the scene renderer. Supplied pavilion renders remain reference imagery for material studies alongside the live 3D viewer with Explore and Shot navigation.

**Key Characteristics:**

- Smoked glass with an opaque accessibility fallback.
- Rounded panels and compact, clearly labeled controls.
- Warm amber for primary actions and linked selection.
- Manrope with stable tabular numerals for measurements and time.

## Colors

Charcoal and sage neutrals keep scene imagery prominent; warm amber provides the active signal. Frontmatter values preserve the CSS source format and are normative.

### Primary

- **Amber** (`accent`, `accent-hover`): primary actions, selected objects, timeline playhead, and focus. `on-accent` is the dark label color on amber fills.
- **Amber selection wash** (`selection`): selected object rows and accent badges.

### Neutral

- **Smoked charcoal** (`canvas`, `surface`, `surface-raised`): page foundation, opaque fallback, and solid controls.
- **Warm white** (`text`): primary reading; **sage gray** (`text-secondary`, `text-muted`): supporting labels and metadata. The live scene overrides those two supporting text variables with the brighter `viewer-text-secondary` and `viewer-text-muted` values to preserve reading over its more translucent overlays. These are scoped viewer values, not new global CSS variable names.
- **Highlight rims** (`border`, `border-strong`): subtle panel edges and more visible control boundaries.
- **Smoked glass** (`surface-glass-light`, `surface-glass-default`, `surface-glass-dense`): one shared tint at light, panel, and precision densities.

### Semantic states

Soft green (`success`) supports ready states. Soft coral (`danger`) supports validation and destructive actions. Both accompany text rather than replacing it.

**The Clear Signal Rule.** Use amber to connect selection, primary action, and timing; pair state color with a written label or semantic control state.

## Typography

**Display and body font:** Manrope Variable, sans-serif fallback. **Code font:** SFMono-Regular, Consolas, monospace. Manrope carries the interface from headings to measurement labels; code and ruler annotations use the mono stack.

### Hierarchy

The frontmatter records the implemented reference hierarchy: display, headline, title, body, label, and code. Display and headline use medium weight and restrained negative tracking; titles are semibold; body copy is regular. Labels use sentence case. Button labels are semibold rather than the specimen label weight.

The standard body inherits its line height from the page; the specimen’s rounded line-height captions are descriptive, not exact CSS values. Small badges use `--text-xs`. The introductory paragraph is limited to 58ch. Large reference type scales down at the layout breakpoints; the oversized “See the story” specimen is a demonstration, not an additional default heading role.

**The Stable Numbers Rule.** Use tabular numerals for timecodes, frame counts, vectors, and property values so changes do not shift the surrounding interface.

## Layout

Use the existing 4px spacing rhythm for reusable groups, while allowing optical adjustments in compact toolbars and data tracks. Group related controls tightly and give task boundaries more room. Token names in the frontmatter map directly to `--space-*`; color names map to `--color-*`, except `surface-glass-*`, which map directly to their CSS variable names, and the explicitly documented viewer text overrides.

The live viewer fills the window at `100dvh` with no outer margin, page padding, rounded stage edge, or top application header. The scene remains behind the floating controls. Heading and utility groups sit near the top; the mode toolbar, camera selector, object browser, inspector, and timeline occupy separate overlay positions. The timeline remains anchored near the bottom. Side panels scroll within bounded heights rather than extending the viewer into page scrolling. Safe-area insets protect the top and bottom overlay positions.

At 800px and below, the canvas still fills the viewport. The object browser is hidden, the inspector starts closed, and opening it presents a bounded floating sheet above the bottom controls, with internal scrolling. The timeline stays floating at the bottom; it does not stack below the canvas. Heading and utility controls share the upper edge, while mode selection, the camera selector, movement controls, and instructions use their compact positions. At 480px and below, compact timeline and toolbar details simplify. On desktop windows 650px high or shorter, the object browser is hidden, the inspector’s height is constrained, and utility controls move beside the camera selector. The viewer does not rely on a tall minimum stage or short-desktop page scrolling.

The reference page retains its application header and document flow, a maximum width of 1440px, and section navigation beside the content. At 1150px and below, type, spacing, and columns become more compact. At 800px and below, reference navigation becomes a horizontal scrolling row and component sections stack. At 480px and below, reference fields stack. At 1600px and above, viewer side panels expand. These are observed layout breakpoints, not a requirement that every new surface reproduce either composition.

## Elevation & Depth

Glass combines translucent tint, a thin border, a blurred backdrop (32px), and an ambient downward shadow. Light glass uses 60% opacity for brief content, default glass uses 64% for panels, and dense glass uses 72% for precision controls. Actual density selection is explicit: the current viewer toolbar uses default glass, and the timeline uses dense glass. Shadows separate controls from imagery without a hard offset silhouette.

### Shadow vocabulary

- **Panel:** `--shadow-panel` supplies the diffuse lift, a brighter upper inset highlight, and a faint lower inset edge.
- **Control:** `--shadow-control` gives small primary controls and markers a restrained lift.
- **Focus:** `--focus-ring` adds a canvas separation ring and amber outer ring; the timeline instead outlines its track area when its scrubber is focused.

Exact effects live in the sidecar because the frontmatter component schema does not support them.

**The Single Glass Layer Rule.** Use one glass layer per floating panel; controls inside use solid fills or quiet transparent states rather than another blurred panel.

The shared clarity preference replaces all three glass fills with the opaque surface and removes blur. It persists locally through `PreferencesProvider`; the operating-system reduced-transparency query also enforces opaque glass. Unsupported backdrop filtering falls back to solid surfaces for glass panels, the reference selector, and markers. Short state transitions use the fast or normal duration and the shared ease-out curve. Reduced motion removes smooth scrolling and reduces CSS transition and animation durations; it does not disable deliberately requested timeline playback.

## Shapes

Panels use the panel radius, controls the control radius, and grouped controls the medium radius. Small controls use the small radius; badges and compact data cells use the extra-small radius. The retained stage radius is available for framed scene containers; the live viewer overrides it with a square, edge-to-edge viewport. Pill shapes are reserved for markers and switches. One-pixel rims define boundaries without making the page feel like a grid of boxes. Local responsive corner adjustments are implementation details, not additions to the reusable radius scale.

## Components

The reusable exports live in `src/components/ui/primitives.tsx`; transparency state lives in `src/components/ui/preferences.tsx`. Standard HTML attributes pass through where the API uses native attribute types.

### Buttons

`Button` accepts `variant="primary" | "secondary" | "ghost" | "danger"`, `size="sm" | "md"`, `loading`, and `iconOnly`. Defaults are secondary, medium, and `type="button"`. Primary is amber; secondary is raised charcoal; ghost recedes; danger uses coral text and a restrained tinted fill. In the live viewer, secondary buttons use a translucent dark fill with a stronger hover fill, preserving the single blurred parent layer. The frontmatter records these scoped viewer variants separately.

Medium controls have a minimum height of 40px and small controls 34px. Icon-only variants use matching widths. Hover changes fill or border, active shifts downward by 1px, and disabled controls reduce opacity. Loading adds a spinner, disables activation, and sets `aria-busy`. Supply an accessible name to every icon-only button and `aria-pressed` for toggle actions. Do not style an anchor as disabled; navigation remains a link.

### Glass panels

`GlassPanel` accepts `density="light" | "default" | "dense"` and standard div attributes; default density is `default`. It supplies the material, border, radius, and elevation. Padding belongs to the composed panel so an inspector and timeline can use appropriate density. Add a semantic region label when the panel forms a distinct tool area.

### Badges

`Badge` accepts `tone="neutral" | "accent" | "success" | "danger"` and children. Neutral is the default. A compact rounded rectangle with a tinted border supports a short written status; it is not an interactive chip.

### Fields

`TextField` requires `id` and `label`, with optional `hint` and `error`, plus native input props. It is a solid canvas field with a strong rim, persistent label, and 44px height. Hover strengthens the border; keyboard focus uses the shared ring. Error text replaces the hint, links through `aria-describedby`, and sets `aria-invalid`. Controlled value, validation, and native disabled behavior belong to the caller; there is no distinct disabled-field visual variant in this foundation.

### Mode selection and switches

`SegmentedControl<T>` takes `label`, `value`, `options: { value, label, icon? }[]`, and `onChange`. A native radio group provides exclusive selection and keyboard arrow navigation; the selected segment is raised charcoal in the base component. Inside the live viewer it uses a translucent warm-white fill and a subtle upper inset highlight. Its `label` also becomes the radio group name, so use distinct labels for separate groups on one page.

`Toggle` takes `checked`, `onChange`, `label`, and optional `hint`. It uses a native checkbox with switch semantics; amber fill and thumb position show the on state. The visible track is smaller than its 44px input target. Focus rings appear on the visible track.

### Navigation

`AppHeader` accepts `designSystem?: boolean`; the design-system page retains it with a link to the viewer and the shared transparency preference. The live viewer does not mount this header. Its floating utility group contains the clarity toggle, design-system link, and inspector toggle, each with an accessible name; the toggles expose pressed state. Focus view hides the utility group along with inspection panels and the timeline. Reference section links form a quiet vertical list with a tonal hover treatment, turning into a horizontal overflow row on small screens. Navigation remains semantic links; the current section list does not implement a tracked active-section state.

### Properties, selection, and timeline

`PropertyRow` takes `label` and children and belongs inside a `dl`. Labels recede, values align right and wrap when needed, and numeric data uses tabular figures. Empty inspector states explain the next action. Geometry clicks, camera markers, object rows, selection bounds, and inspector selection share one entity ID.

`Timeline` takes `frame`, `playing`, `onFrameChange`, `onPlayChange`, and `onCameraSelect`, plus optional `shot`, `frameEnd`, `fps`, and `onShotSelect`. Transport, frame range input, playhead, and readouts share the caller’s state; seeking pauses playback. The imported camera and generated draft occupy separate, selectable tracks, with the draft name, duration, subject, and mark count providing written context. The source scene spans frames 1–374 at 24 fps and its camera animation spans frames 1–250. The range expands for longer drafts; shorter clips hold their final pose. Draft time starts at frame 1 = 0 seconds, while imported animation retains its Blender export offset. These are scene and playback data, not design tokens. Reference imagery remains explicitly labeled on the design-system page.

The viewer uses the shared segmented control for Explore and Shot modes. Explore supports orbit drag, pan, zoom, Alt-drag look, and keyboard movement. A small side hint shows the arrow, Space, and Ctrl shortcuts. Shot follows a selected source or draft camera and uses a 16:9 viewing area. Contextual instructions stay near the lower edge of the scene. Selecting an object updates the inspector without moving the view; framing it is a separate explicit action.

### Camera authoring

The inspector’s Object / Camera move segmented control places authoring within the existing glass panel. A selected geometry object offers **Create camera move**; the authoring section also exposes a labeled Subject selector. `ShotAuthoring` receives scene objects, selection and its callback, a snapshot capture ref, the current `shot`, and callbacks for generation, edits, preview, path visibility, seeking, and removal. The viewer owns the draft and playback state.

Subject and grouped preset selectors lead the form, followed by duration and lens fields. **Framing & sensor** discloses secondary settings and the preset description. **Generate move** is the primary action and requires a non-camera subject; validation and unavailable-bounds errors appear beside the form. Generated content includes its name, subject, duration, mark count, **Preview**, **Path**, and the expandable **Edit camera marks** section. Fields retain labels and units; numeric values use the existing stable-number convention. These controls reuse the current button, field, and single-glass-layer vocabulary without adding system tokens.

Generate or Regenerate selects the draft in Shot mode, pauses at its first frame, and replaces any previous mark edits. Preview restarts draft playback. Choosing a mark seeks to its time and pauses; editing position, lens, or roll also pauses playback. **Keep subject centered** controls tracking and pauses playback when changed; pan and tilt fields remain disabled while centering is enabled. **Discard draft** clears the draft, selects the imported Camera.002, and resets the playhead. Session-loss and regeneration copy remain visible, along with the geometry-intersection limitation and Blockout attribution.

At 800px and below, generating a move or explicitly choosing Preview closes the inspector so the Shot image and timeline transport remain visible. Showing Path also closes that sheet, switches to Orbit, and fits the trajectory, marks, and subject within the scene area left clear by the visible panels, toolbar, and timeline. The path overview recomputes its fit when the viewport size changes. The path’s amber curve and marks connect to the existing selection language; they do not imply collision or occlusion checks.

### Usage

Use interactive primitives in a client component. The app layout already supplies `PreferencesProvider` and the global font and styles.

```tsx
import { Button, GlassPanel, PropertyRow, TextField } from '@/components/ui/primitives';

<GlassPanel density="dense" role="region" aria-label="Camera properties" style={{ padding: 'var(--space-6)' }}>
  <dl><PropertyRow label="Focal length">36 mm</PropertyRow></dl>
  <TextField id="camera-name" label="Camera name" defaultValue="Camera.002" />
  <Button variant="primary" onClick={onSelect}>Select camera</Button>
</GlassPanel>
```

Use `usePreferences()` inside the provider to read `opaque` and call `setOpaque`. Reuse that state rather than adding a second transparency preference. The sidecar contains framework-free visual snippets for the reference panel; application behavior remains in the React components.

## Do's and Don'ts

### Do:

- Do reuse the CSS tokens and exported primitives before adding local variants.
- Do choose glass density according to reading load and preserve the opaque fallback.
- Do label icon buttons, associate inputs with labels and help text, and expose selected or pressed state.
- Do keep focus visible and honor reduced motion and transparency preferences.
- Do identify reference imagery and demonstration-only controls accurately as renderer integration evolves.

### Don't:

- Don’t nest blurred panels inside blurred panels.
- Don’t communicate selection, success, or errors through color alone.
- Don’t shrink the desktop composition to fit a phone; retain the full-window scene and expose inspection in a bounded floating sheet.
- Don’t treat specimen-only display flourishes or small timeline annotations as the default type scale.
