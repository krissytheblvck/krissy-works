"""
Brilliant Metal Works — Balcony Parameter Reader
================================================
Paste this script into a GHPython component in Grasshopper.
No inputs or outputs need to be wired — just paste your file
path on the line below and click Run.

OUTPUTS (add these on the GHPython component):
  length          height          num_sections    post_count
  post_profile    bottom_rail     top_rail        catch_profile
  infill_type     sheet_thickness sheet_width     sheet_height
  glass_thickness glass_system    panel_width     bar_profile
  bar_spacing     mounting_type   wall_type       project_code
  panel_layout    panel_height    panel_gap_top
  status_msg
"""

import json
import os

# ── PASTE YOUR FILE PATH HERE ──────────────────────────────────────────────────
json_path = r"C:\Users\Christian's Laptop\Downloads\BAL-001_grasshopper.json"
# ──────────────────────────────────────────────────────────────────────────────

status_msg = ""

# Defaults
length = height = 0
num_sections = 0
post_count = 0
post_profile = bottom_rail = top_rail = catch_profile = ""
infill_type = ""
sheet_thickness = 2.0
sheet_width  = 2000.0
sheet_height = 1000.0
glass_thickness = 10.0
glass_system    = "framed_post"
panel_width     = 1000.0
bar_profile = ""
bar_spacing = 100.0
mounting_type = wall_type = ""
project_code = ""
panel_layout  = "full_height"
panel_height  = 0.0
panel_gap_top = 0.0

if not os.path.exists(json_path):
    status_msg = "File not found — check the path at the top of this script:\n{}".format(json_path)
else:
    try:
        with open(json_path, "r") as f:
            data = json.load(f)

        geo   = data.get("geometry", {})
        prof  = data.get("profiles", {})
        infil = data.get("infill", {})
        mount = data.get("mounting", {})

        # ── Geometry ──────────────────────────────────────────────────────────
        length       = float(geo.get("length", 0))
        height       = float(geo.get("height", 0))
        num_sections = int(geo.get("num_sections") or 0)

        if num_sections > 0:
            post_count = num_sections + 1
        else:
            ps = float(geo.get("post_spacing") or 1200)
            post_count = int(length / ps) + 1 if ps > 0 else 1

        # ── Profiles ──────────────────────────────────────────────────────────
        post_profile  = str(prof.get("post",         "40x40"))
        bottom_rail   = str(prof.get("bottom_rail",  "40x20"))
        top_rail      = str(prof.get("top_rail",     "40x40"))
        catch_profile = str(prof.get("catch",        "20x20"))

        # ── Infill ────────────────────────────────────────────────────────────
        infill_type     = str(infil.get("type", "plain_sheet"))
        sheet_thickness = float(infil.get("sheet_thickness") or 2)
        sheet_width     = float(infil.get("sheet_width_mm")  or 2000)
        sheet_height    = float(infil.get("sheet_height_mm") or 1000)
        glass_thickness = float(infil.get("glass_thickness") or 10)
        glass_system    = str(infil.get("glass_system")      or "framed_post")
        bar_profile     = str(infil.get("bar_profile")       or "40x20")
        bar_spacing     = float(infil.get("bar_spacing")     or 100)
        panel_layout    = str(infil.get("panel_layout")      or "full_height")
        panel_height    = float(infil.get("panel_height_mm") or 0)
        panel_gap_top   = float(infil.get("panel_gap_top_mm") or 0)

        if infill_type == "glass" and glass_system != "framed_post":
            panel_width = float(infil.get("panel_width_mm") or 1000)
        else:
            panel_width = float(length / max(num_sections, 1))

        # ── Mounting ──────────────────────────────────────────────────────────
        mounting_type = str(mount.get("type",      "wall"))
        wall_type     = str(mount.get("wall_type") or "concrete")

        # ── Meta ──────────────────────────────────────────────────────────────
        project_code = str(data.get("project_id", "UNKNOWN"))

        if infill_type == "glass" and glass_system != "framed_post":
            n = int(round(length / panel_width)) if panel_width > 0 else num_sections
            status_msg = "OK — {} | {}mm x {}mm | Glass {} | {} panels x {}mm".format(
                project_code, int(length), int(height), glass_system, n, int(panel_width))
        else:
            inset_note = " | INSET panel {}mm".format(int(panel_height)) if panel_layout == "inset" and panel_height > 0 else ""
            status_msg = "OK — {} | L={}mm H={}mm | {} sections {} posts | {}{}".format(
                project_code, int(length), int(height),
                num_sections, post_count, infill_type, inset_note)

    except Exception as e:
        status_msg = "Error: {}".format(str(e))
