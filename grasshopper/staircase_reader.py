"""
Brilliant Metal Works — Staircase Parameter Reader
===================================================
Paste this into a GHPython component in Grasshopper.

INPUTS (add on the component):
  json_path  → str   (Panel with full path to the .json file)
  reload     → bool  (Button to force re-read)

OUTPUTS (add on the component):
  total_rise          → Number (mm)
  total_run           → Number (mm)
  width               → Number (mm)
  stringer_length     → Number (mm)
  slope_angle_deg     → Number (degrees)
  num_steps           → Number
  step_rise           → Number (mm)
  step_going          → Number (mm)
  handrail_height     → Number (mm)
  post_count          → Number
  num_panels          → Number
  rail_sides          → Text ("one" or "both")
  post_profile        → Text
  top_rail_profile    → Text
  bottom_rail_profile → Text
  infill_type         → Text
  sheet_thickness     → Number (mm)
  sheet_width         → Number (mm)  — chosen sheet width (e.g. 2000 or 2440)
  sheet_height        → Number (mm)  — chosen sheet height (e.g. 1000 or 1220)
  glass_thickness     → Number (mm)
  glass_system        → Text         — "framed_post" | "spigot" | "channel_base" | "embedded"
  panel_width         → Number (mm)  — glass panel width for non-framed systems
  bar_spacing         → Number (mm)
  catch_profile       → Text         — inner catch frame profile (e.g. "20x20")
  panel_slope_edge    → Number (mm)  — top/bottom edge of each CNC panel
  panel_height        → Number (mm)  — left/right edge of each CNC panel
  panel_angle         → Number (deg) — interior angle of CNC panel
  panel_bounding_w    → Number (mm)  — bounding rect width for cutting
  panel_bounding_h    → Number (mm)  — bounding rect height for cutting
  total_panels        → Number
  project_code        → Text
  status_msg          → Text (feedback)
"""

import json
import math
import os

status_msg = ""

# Default all outputs to 0 / empty
total_rise = total_run = width = stringer_length = slope_angle_deg = 0
num_steps = step_rise = step_going = 0
handrail_height = post_count = num_panels = 0
rail_sides = post_profile = top_rail_profile = bottom_rail_profile = ""
infill_type = ""
sheet_thickness = 2.0
sheet_width     = 2000.0
sheet_height    = 1000.0
glass_thickness = 10.0
glass_system    = "framed_post"
panel_width     = 1000.0
bar_spacing = 0
catch_profile = "20x20"
panel_slope_edge = panel_height = panel_angle = panel_bounding_w = panel_bounding_h = 0
total_panels = 0
project_code = ""

if not json_path:
    status_msg = "Connect a Panel with the .json file path."
elif not os.path.exists(str(json_path)):
    status_msg = "File not found: {}".format(json_path)
else:
    try:
        with open(str(json_path), "r") as f:
            data = json.load(f)

        if data.get("project_type") != "staircase":
            status_msg = "WARNING: This JSON is not a staircase file (type={})".format(
                data.get("project_type", "unknown"))

        geo   = data.get("geometry", {})
        rail  = data.get("handrail", {})
        prof  = data.get("profiles", {})
        infil = data.get("infill", {})
        cnc   = data.get("panel_cnc", {})

        # Geometry
        total_rise      = float(geo.get("total_rise_mm", 0))
        total_run       = float(geo.get("total_run_mm", 0))
        width           = float(geo.get("width_mm", 1200))
        stringer_length = float(geo.get("stringer_length_mm", 0))
        slope_angle_deg = float(geo.get("slope_angle_deg", 0))
        num_steps       = int(geo.get("num_steps", 0))
        step_rise       = float(geo.get("step_rise_mm", 175))
        step_going      = float(geo.get("step_going_mm", 0))

        # Handrail
        handrail_height = float(rail.get("height_mm", 1000))
        post_count      = int(rail.get("post_count", 0))
        num_panels      = int(rail.get("num_panels", 0))
        rail_sides      = str(rail.get("sides", "one"))
        catch_profile   = str(rail.get("catch_profile") or "20x20")

        # Profiles
        post_profile        = str(prof.get("post", "40x40"))
        top_rail_profile    = str(prof.get("top_rail", "40x40"))
        bottom_rail_profile = str(prof.get("bottom_rail", "40x20"))

        # Infill
        infill_type     = str(infil.get("type", "plain_sheet"))
        sheet_thickness = float(infil.get("sheet_thickness_mm") or 2)
        sheet_width     = float(infil.get("sheet_width_mm") or 2000)
        sheet_height    = float(infil.get("sheet_height_mm") or 1000)
        glass_thickness = float(infil.get("glass_thickness_mm") or 10)
        glass_system    = str(infil.get("glass_system") or "framed_post")
        panel_width     = float(infil.get("panel_width_mm") or 1000)
        bar_spacing     = float(infil.get("bar_spacing_mm") or 100)

        # CNC panel data
        panel_slope_edge  = float(cnc.get("cut_slope_edge_mm") or cnc.get("slope_edge_mm", 0))
        panel_height      = float(cnc.get("height_mm", 0))
        panel_angle       = float(cnc.get("interior_angle_deg", 0))
        panel_bounding_w  = float(cnc.get("bounding_rect_width_mm", 0))
        panel_bounding_h  = float(cnc.get("bounding_rect_height_mm", 0))
        total_panels      = int(cnc.get("total_panels", 0))
        project_code      = str(data.get("project_id", "UNKNOWN"))

        is_glass_only = (infill_type == "glass" and
                          glass_system in ("spigot", "channel_base", "embedded"))
        if is_glass_only:
            n_panels = int(math.ceil(stringer_length / panel_width)) if panel_width > 0 else num_panels
            status_msg = (
                "OK — {} | Rise={:.0f}mm Run={:.0f}mm | "
                "{} steps | Glass {} | {} panels × {:.0f}mm | {}mm glass"
            ).format(
                project_code, total_rise, total_run,
                num_steps, glass_system, n_panels, panel_width, int(glass_thickness)
            )
        else:
            status_msg = (
                "OK — {} | Rise={:.0f}mm Run={:.0f}mm | "
                "{} steps @ {:.0f}mm rise | {} posts | "
                "Panel: {}x{}mm @ {}deg | Sheet: {}x{}mm"
            ).format(
                project_code, total_rise, total_run,
                num_steps, step_rise, post_count,
                int(panel_slope_edge), int(panel_height), panel_angle,
                int(sheet_width), int(sheet_height)
            )

    except Exception as e:
        status_msg = "ERROR: {}".format(str(e))
