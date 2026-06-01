# Brilliant Metal Works — Grasshopper Guide

---

## BALCONY PROJECTS

### Setup (one time only)

1. Open Rhino → type `Grasshopper` → Enter
2. Add a **GHPython** component → paste `balcony_reader.py`
3. Add a second **GHPython** component → paste `balcony_geometry.py`
4. Connect outputs of reader → inputs of geometry

### Daily Use
1. Export `.json` from web app (click **Export to Rhino**)
2. Add a **Panel** → type the full file path
3. Connect Panel → `json_path` input of reader
4. Toggle `reload` → model updates

---

## STAIRCASE PROJECTS

### Setup (one time only — do this once, save as template)

**Step 1 — Open Grasshopper**
In Rhino, type `Grasshopper` in the command line → Enter.

**Step 2 — Add the Reader component**
1. Go to **Maths → Script → GHPython** → drag one onto canvas
2. Double-click it → paste the entire contents of `staircase_reader.py`
3. Right-click the component → **Inputs** → add these (all type: **str** or **float**, name matters):
   - `json_path` (str)
   - `reload` (bool)
4. Right-click → **Outputs** → add all of these (copy names exactly):
   - `total_rise`, `total_run`, `width`
   - `stringer_length`, `slope_angle_deg`
   - `num_steps`, `step_rise`, `step_going`
   - `handrail_height`, `post_count`, `num_panels`, `rail_sides`
   - `post_profile`, `top_rail_profile`, `bottom_rail_profile`
   - `infill_type`, `sheet_thickness`, `sheet_width`, `sheet_height`, `glass_thickness`, `bar_spacing`
   - `panel_slope_edge`, `panel_height`, `panel_angle`
   - `panel_bounding_w`, `panel_bounding_h`, `total_panels`
   - `project_code`, `status_msg`
5. Click **OK**

**Step 3 — Add the Geometry component**
1. Drag a second **GHPython** component onto canvas
2. Paste the entire contents of `staircase_geometry.py`
3. Add **Inputs** with these names:
   - `total_rise`, `total_run`, `width`
   - `stringer_length`, `slope_angle_deg`
   - `num_steps`, `step_rise`, `step_going`
   - `handrail_height`, `post_count`, `num_panels`, `rail_sides`
   - `post_profile`, `infill_type`, `sheet_thickness`, `sheet_width`, `sheet_height`
   - `sheet_width`, `sheet_height`
   - `panel_slope_edge`, `panel_height`, `panel_angle`
   - `panel_bounding_w`, `panel_bounding_h`, `total_panels`
   - `origin` (Point3d — optional)
4. Add **Outputs**:
   - `stringer_line`, `step_lines`, `post_lines`
   - `top_rail_line`, `bottom_rail_line`
   - `infill_surfaces`, `cnc_panels`, `cnc_bounding_rects`
   - `report`
5. Connect every matching output from the Reader → input of Geometry

**Step 4 — Connect the file path**
1. Add a **Panel** (Params → Input → Panel)
2. Type the full path to your JSON file:
   ```
   C:\Users\YourName\Downloads\STA-001_grasshopper.json
   ```
3. Connect the Panel → `json_path` input of the Reader

**Step 5 — Visualize**
Add display components:
- Connect `stringer_line` → **Curve** display component (red)
- Connect `step_lines` → **Curve** display (gray)
- Connect `post_lines` → **Curve** display (black)
- Connect `top_rail_line` → **Curve** display (black)
- Connect `infill_surfaces` → **Surface** display (blue, 50% transparency)
- Connect `cnc_panels` → **Surface** display (orange) — these are the FLAT CNC panels
- Connect `cnc_bounding_rects` → **Surface** display (yellow, wireframe) — bounding rectangles
- Connect `report` → **Panel** to read the full summary

**Save this file as `brilliant_staircase_template.gh`**

---

## What You See in Rhino

**Left side of the model:**
The 3D staircase with the frame, steps, posts, rails, and inclined infill panels shown in place.

**Right side of the model (800mm gap):**
All CNC panels laid **flat** side by side — these are the exact shapes to cut from the sheet.
- Orange surfaces = the parallelogram panels to cut
- Yellow rectangles = the bounding sheet size each panel needs

**The Report panel tells you:**
- Exact step dimensions (rise × going)
- Panel dimensions: slope edge, height, angle
- Bounding rectangle size (what size to cut from sheet)
- Total panel count
- Note about nesting alternate panels to save material

---

## Daily Use (for each project)

1. Export the `.json` from the web app → click **Export to Rhino** on any staircase project
2. In Grasshopper, update the Panel with the new file path
3. Toggle the `reload` button → everything updates instantly
4. The 3D model shows the staircase in Rhino viewport
5. The flat CNC panels appear to the right — dimensions are in the Report panel
6. Send those dimensions to the CNC operator (or export as DXF)

---

## Exporting CNC panels as DXF for the cutting machine

1. In Rhino, select the flat orange CNC panels
2. Type `Export` → choose **DXF** format
3. Send the DXF file to the laser/CNC operator
4. They load it directly into the cutting machine — no measuring, no tracing
