# StewardFlow UI/UX Template v1

## Figma MCP Outputs
- Design System: https://www.figma.com/online-whiteboard/create-diagram/8dc3c7d9-9175-4d8e-8968-7f27e8eb7e4a?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=5e9d54ad-b55f-43de-ae46-926b5e77f2e9
- Screen Blueprint: https://www.figma.com/online-whiteboard/create-diagram/acd414e8-2c97-47d2-b61e-fd707b98a721?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=3895cf15-9f8d-4edd-8202-f818758db233

## Core Principles
- Card/surface radius is limited to `rounded-2xl` at container level.
- Form control height is unified to `h-10`.
- Action hierarchy: `btn-primary` (main), `btn-ghost` (secondary), `btn-danger` (destructive).
- Status/filter chips use unified pill style for readability and consistency.
- Empty/loading/error states always use `Notice` component.

## Class Tokens (Current Project)
- Page hero: `surface-panel`
- Section card: `surface-card`
- Manage tabs wrapper: `tab-shell`
- Tab button: `tab-chip`, active `tab-chip-active`
- Filter button: `filter-pill`, active `filter-pill-active`
- Input/select/textarea: `form-input`, `form-select`, `form-textarea`
- Static readonly field: `field-static`
- Icon actions: `icon-button`, destructive `icon-button-danger`
- Main action button: `btn-primary`
- Secondary action button: `btn-ghost`
- Destructive action button: `btn-danger`

## Screen Template

### 1) Management Screen
1. `surface-panel` hero (title + description)
2. `tab-shell` for management category
3. Multiple `surface-card` blocks for admin panel, reservation manager, and requests

### 2) List Screen
1. `surface-panel` hero with CTA
2. Search/select filters in one block
3. Status filter row with `filter-pill`
4. Card/list grid using `surface-card`
5. Empty and error via `Notice`

### 3) Detail/Reservation Screen
1. Resource summary in `surface-card`
2. Reservation status and timeline
3. Form controls with unified `form-*`
4. Confirmation feedback after submit (toast/message)

### 4) Edit/Create Form Screen
1. Hero in `surface-panel`
2. Form in `surface-card`
3. Upload area uses single visual pattern
4. Delete is modal + `btn-danger`

### 5) Notification Screen
1. Hero in `surface-panel`
2. Toolbar in `surface-card`
3. Grouped list cards with expandable details
4. Read/unread actions are immediate and reflected in badge state

## Rollout Order (Recommended)
1. `assets/manage`, `spaces/manage`, `vehicles/manage`
2. `assets` list and card
3. `assets/[id]/edit` and `assets/new`
4. `notifications`
5. remaining settings and feedback pages

## QA Checklist
- Desktop and mobile spacing alignment
- Button and input heights are visually equal
- Tab and filter active state clearly distinguishable
- Modal corner radius and border consistent
- Empty and error states readable on mobile
