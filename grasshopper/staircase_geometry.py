"""
Brilliant Metal Works — Staircase Geometry Builder
===================================================
Paste this into a second GHPython component in Grasshopper.
Connect all outputs from staircase_reader.py to the matching inputs here.

INPUTS (connect from reader):
  total_rise          → Number (mm)
  total_run           → Number (mm)
  width               → Number (mm)
  stringer_length     → Number (mm)
  slope_angle_deg     → Number
  num_steps           → Number
  step_rise           → Number (mm)
  step_going          → Number (mm)
  handrail_height     → Number (mm)
  post_count          → Number
  num_panels          → Number
  rail_sides          → Text
  post_profile        → Text
  top_rail_profile    → Text
  bottom_rail_profile → Text
  catch_profile       → Text
  infill_type         → Text
  sheet_width         → Number (mm)
  sheet_height        → Number (mm)
  glass_system        → Text  ("framed_post" | "spigot" | "channel_base" | "embedded")
  panel_width         → Number (mm)  — glass panel width for non-framed systems
  glass_thickness     → Number (mm)
  panel_slope_edge    → Number (mm)
  panel_height        → Number (mm)
  panel_angle         → Number (deg)
  panel_bounding_w    → Number (mm)
  panel_bounding_h    → Number (mm)
  total_panels        → Number
  project_code        → Text
  origin              → Point3d  (optional)

OUTPUTS:
  stringer_line       → Line      — main diagonal stringer
  step_lines          → Lines     — step treads + risers
  post_lines          → Lines     — vertical handrail posts (steel systems)
  top_rail_line       → Polyline  — top handrail rail
  bottom_rail_line    → Polyline  — bottom reference rail
  infill_surfaces     → Surfaces  — inclined infill panels (steel systems)
  catch_frame_lines   → Lines     — inner catch frame (plain_sheet only)
  cnc_panels          → Surfaces  — flat CNC parallelogram panels (steel only)
  cnc_bounding_rects  → Surfaces  — bounding rectangles for CNC cutting
  glass_surfaces      → Surfaces  — inclined glass panel Breps (glass systems)
  spigot_points       → Points    — spigot base positions (spigot system)
  spigot_lines        → Lines     — spigot rod geometry 150mm tall
  channel_line        → Line      — base channel full stringer length (channel_base)
  embed_lines         → Lines     — embedment depth lines (embedded system)
  report              → Text
"""

import Rhino.Geometry as rg
import math

# ── Helpers ───────────────────────────────────────────────────────────────────
def parse_w(profile):
    try: return float(str(profile).split('x')[0])
    except: return 40.0

def parse_h(profile):
    try: return float(str(profile).split('x')[1])
    except: return 40.0

# ── Origin ────────────────────────────────────────────────────────────────────
if origin is None:
    ox, oy, oz = 0.0, 0.0, 0.0
else:
    ox, oy, oz = float(origin.X), float(origin.Y), float(origin.Z)

# ── Safety checks & defaults ──────────────────────────────────────────────────
total_rise    = float(total_rise or 2800)
total_run     = float(total_run  or 3500)
width         = float(width      or 1200)
stringer_len  = float(stringer_length or math.hypot(total_run, total_rise))
handrail_h    = float(handrail_height or 1000)
post_count    = int(post_count or 4)
num_steps     = int(num_steps  or 16)
step_r        = float(step_rise  or 175)
step_g        = float(step_going or 218)
slope_deg     = float(slope_angle_deg or 38)
slope_rad     = math.radians(slope_deg)
cos_a         = math.cos(slope_rad)
sin_a         = math.sin(slope_rad)
panel_s_edge  = float(panel_slope_edge or 1200)
panel_h_mm    = float(panel_height     or 1000)
panel_ang     = float(panel_angle      or 52)
panel_bw      = float(panel_bounding_w or 1000)
panel_bh      = float(panel_bounding_h or 1600)
tot_panels    = int(total_panels or 3)
sides         = 2 if str(rail_sides) == "both" else 1
sheet_w       = float(sheet_width  or 2000)
sheet_h_val   = float(sheet_height or 1000)
glass_system  = str(glass_system  or "framed_post") if glass_system else "framed_post"
panel_width   = float(panel_width or 1000) if panel_width else 1000.0
glass_thick   = float(glass_thickness or 10) if glass_thickness else 10.0

# Profile dimensions
post_w        = parse_w(post_profile        or "40x40")
top_rail_h_mm = parse_h(top_rail_profile    or "40x40")
bot_rail_h_mm = parse_h(bottom_rail_profile or "40x20")
catch_size    = parse_w(catch_profile       or "20x20")

is_glass_only = (str(infill_type) == "glass" and
                 glass_system in ("spigot", "channel_base", "embedded"))

num_panels_frame = post_count - 1 if post_count > 1 else 1
spacing_horiz    = total_run  / num_panels_frame if num_panels_frame > 0 else total_run
spacing_vert     = total_rise / num_panels_frame if num_panels_frame > 0 else total_rise

# ── Empty output lists ─────────────────────────────────────────────────────────
post_lines        = []
infill_surfaces   = []
catch_frame_lines = []
cnc_panels        = []
cnc_bounding_rects= []
glass_surfaces    = []
spigot_points     = []
spigot_lines      = []
channel_line      = None
embed_lines       = []

# ── ALWAYS: Stringer line ─────────────────────────────────────────────────────
stringer_start = rg.Point3d(ox, oy, oz)
stringer_end   = rg.Point3d(ox + total_run, oy, oz + total_rise)
stringer_line  = rg.Line(stringer_start, stringer_end)

# ── ALWAYS: Steps (treads + risers) ──────────────────────────────────────────
step_lines = []
for i in range(num_steps + 1):
    x = ox + i * step_g
    z = oz + i * step_r
    if i < num_steps:
        step_lines.append(rg.Line(rg.Point3d(x, oy, z), rg.Point3d(x + step_g, oy, z)))
    if i > 0:
        step_lines.append(rg.Line(rg.Point3d(x, oy, oz + (i - 1) * step_r), rg.Point3d(x, oy, z)))
step_lines.append(rg.Line(rg.Point3d(ox, oy, oz), rg.Point3d(ox, oy + width, oz)))
step_lines.append(rg.Line(stringer_end, rg.Point3d(stringer_end.X, oy + width, stringer_end.Z)))

# ─────────────────────────────────────────────────────────────────────────────
# BRANCH A — GLASS-ONLY SYSTEMS (spigot / channel_base / embedded)
# ─────────────────────────────────────────────────────────────────────────────
if is_glass_only:
    SPIGOT_H    = 150.0
    EMBED_DEPTH = 100.0 if glass_system == "embedded" else 0.0

    # Number of glass panels distributed along the stringer
    num_glass_panels = max(1, int(math.ceil(stringer_len / panel_width)))
    actual_pw_slope  = stringer_len / num_glass_panels  # along slope

    # Slope direction unit vector
    dx_unit = cos_a   # horizontal component per mm along slope
    dz_unit = sin_a   # vertical component per mm along slope

    def stringer_pt(s, y_off=0.0):
        """Point along stringer at arc-length s from start, offset in Y by y_off."""
        return rg.Point3d(ox + s * dx_unit, oy + y_off, oz + s * dz_unit)

    # Top rail follows stringer + handrail_h vertically at each panel joint
    rail_pts = []
    for i in range(num_glass_panels + 1):
        s  = i * actual_pw_slope
        pt = rg.Point3d(ox + s * dx_unit, oy, oz + s * dz_unit + handrail_h)
        rail_pts.append(pt)
    top_rail_line    = rg.Polyline(rail_pts)
    bottom_rail_line = rg.Polyline([stringer_pt(0), stringer_pt(stringer_len)])

    # ── Glass panel surfaces (inclined parallelograms) ────────────────────────
    side_offsets = [0.0] if sides == 1 else [0.0, width]
    for y_off in side_offsets:
        for i in range(num_glass_panels):
            s0 = i       * actual_pw_slope
            s1 = (i + 1) * actual_pw_slope
            gap = 5.0 if num_glass_panels > 1 else 0.0
            s0g = s0 + gap / 2.0
            s1g = s1 - gap / 2.0

            # Bottom edge follows stringer; for embedded it dips below
            bl = rg.Point3d(ox + s0g * dx_unit, oy + y_off, oz + s0g * dz_unit - EMBED_DEPTH)
            br = rg.Point3d(ox + s1g * dx_unit, oy + y_off, oz + s1g * dz_unit - EMBED_DEPTH)
            tr = rg.Point3d(ox + s1g * dx_unit, oy + y_off, oz + s1g * dz_unit + handrail_h)
            tl = rg.Point3d(ox + s0g * dx_unit, oy + y_off, oz + s0g * dz_unit + handrail_h)

            srf = rg.NurbsSurface.CreateFromCorners(bl, br, tr, tl)
            if srf:
                glass_surfaces.append(srf)

    # ── System-specific hardware ──────────────────────────────────────────────
    if glass_system == "spigot":
        for i in range(num_glass_panels + 1):
            s  = i * actual_pw_slope
            base = rg.Point3d(ox + s * dx_unit, oy, oz + s * dz_unit)
            top  = rg.Point3d(ox + s * dx_unit, oy, oz + s * dz_unit + SPIGOT_H)
            spigot_points.append(base)
            spigot_lines.append(rg.Line(base, top))
            if sides == 2:
                spigot_points.append(rg.Point3d(ox + s * dx_unit, oy + width, oz + s * dz_unit))
                spigot_lines.append(rg.Line(
                    rg.Point3d(ox + s * dx_unit, oy + width, oz + s * dz_unit),
                    rg.Point3d(ox + s * dx_unit, oy + width, oz + s * dz_unit + SPIGOT_H)
                ))

    elif glass_system == "channel_base":
        channel_line = rg.Line(
            rg.Point3d(ox, oy, oz),
            rg.Point3d(ox + total_run, oy, oz + total_rise)
        )

    elif glass_system == "embedded":
        for i in range(num_glass_panels + 1):
            s = i * actual_pw_slope
            top_pt = rg.Point3d(ox + s * dx_unit, oy, oz + s * dz_unit)
            bot_pt = rg.Point3d(ox + s * dx_unit, oy, oz + s * dz_unit - EMBED_DEPTH)
            embed_lines.append(rg.Line(top_pt, bot_pt))

    # ── Report ────────────────────────────────────────────────────────────────
    glass_area_m2 = round(num_glass_panels * (actual_pw_slope / 1000.0) *
                          (handrail_h / 1000.0) * cos_a, 3)
    sys_labels = {
        "spigot":       "Spigot (Frameless)",
        "channel_base": "Channel Base",
        "embedded":     "Embedded in Slab/Beam",
    }
    hw_detail = ""
    if glass_system == "spigot":
        hw_detail = "  Spigots:      {} pieces per side (at panel joints + ends)\n".format(num_glass_panels + 1)
    elif glass_system == "channel_base":
        hw_detail = "  Channel:      {:.2f}m along stringer\n".format(stringer_len / 1000.0)
    elif glass_system == "embedded":
        hw_detail = "  Embedment:    {:.0f}mm below stringer line\n".format(EMBED_DEPTH)

    report = (
        "=== BRILLIANT METAL WORKS — STAIRCASE RAILING (GLASS) ===\n"
        "Project: {}\n"
        "\n"
        "STAIRCASE\n"
        "  Rise: {:.0f}mm  Run: {:.0f}mm  Width: {:.0f}mm\n"
        "  Stringer: {:.0f}mm  Slope: {:.1f} deg\n"
        "  Steps: {} × {:.0f}mm rise / {:.0f}mm going\n"
        "\n"
        "GLASS SYSTEM: {}\n"
        "  Panel count:  {} per side\n"
        "  Panel width:  {:.0f}mm along slope\n"
        "  Glass:        {}mm toughened\n"
        "  Glass area:   {:.3f} m² per side\n"
        "  Handrail h:   {:.0f}mm\n"
        "  Sides:        {}\n"
        "\n"
        "HARDWARE\n"
        "{}  Top rail:     {:.2f}m per side\n"
    ).format(
        project_code or "N/A",
        total_rise, total_run, width,
        stringer_len, slope_deg,
        num_steps, step_r, step_g,
        sys_labels.get(glass_system, glass_system),
        num_glass_panels,
        actual_pw_slope,
        int(glass_thick),
        glass_area_m2,
        handrail_h,
        rail_sides or "one",
        hw_detail,
        stringer_len / 1000.0,
    )

# ─────────────────────────────────────────────────────────────────────────────
# BRANCH B — STEEL FRAME SYSTEMS (plain_sheet / flat_bar / framed_post glass)
# ─────────────────────────────────────────────────────────────────────────────
else:
    # ── Posts ─────────────────────────────────────────────────────────────────
    post_bottoms = []
    post_tops    = []

    for i in range(post_count):
        t  = i / (post_count - 1) if post_count > 1 else 0
        px = ox + t * total_run
        pz = oz + t * total_rise
        pb = rg.Point3d(px, oy, pz)
        pt = rg.Point3d(px, oy, pz + handrail_h)
        post_lines.append(rg.Line(pb, pt))
        post_bottoms.append(pb)
        post_tops.append(pt)
        if sides == 2:
            post_lines.append(rg.Line(
                rg.Point3d(px, oy + width, pz),
                rg.Point3d(px, oy + width, pz + handrail_h)
            ))

    top_rail_line    = rg.Polyline(post_tops)
    bottom_rail_line = rg.Polyline(post_bottoms)

    # ── Infill panels (3D inclined) ───────────────────────────────────────────
    for i in range(num_panels_frame):
        t0 = i     / (post_count - 1) if post_count > 1 else 0
        t1 = (i+1) / (post_count - 1) if post_count > 1 else 1
        x0 = ox + t0 * total_run;  z0 = oz + t0 * total_rise
        x1 = ox + t1 * total_run;  z1 = oz + t1 * total_rise

        bl = rg.Point3d(x0, oy, z0)
        br = rg.Point3d(x1, oy, z1)
        tr = rg.Point3d(x1, oy, z1 + handrail_h)
        tl = rg.Point3d(x0, oy, z0 + handrail_h)
        srf = rg.NurbsSurface.CreateFromCorners(bl, br, tr, tl)
        if srf:
            infill_surfaces.append(srf)

        if sides == 2:
            srf2 = rg.NurbsSurface.CreateFromCorners(
                rg.Point3d(x0, oy + width, z0),
                rg.Point3d(x1, oy + width, z1),
                rg.Point3d(x1, oy + width, z1 + handrail_h),
                rg.Point3d(x0, oy + width, z0 + handrail_h)
            )
            if srf2:
                infill_surfaces.append(srf2)

    # ── Inner catch frame (plain_sheet only) ──────────────────────────────────
    if str(infill_type) == "plain_sheet":
        for i in range(num_panels_frame):
            for side_y in ([oy] if sides == 1 else [oy, oy + width]):
                t0 = i     / (post_count - 1) if post_count > 1 else 0
                t1 = (i+1) / (post_count - 1) if post_count > 1 else 1
                x0 = ox + t0 * total_run;  z0_base = oz + t0 * total_rise
                x1 = ox + t1 * total_run;  z1_base = oz + t1 * total_rise
                inset = post_w / 2.0

                lx0 = x0 + cos_a * inset;  lz0 = z0_base + sin_a * inset + bot_rail_h_mm
                lx1 = x0 + cos_a * inset;  lz1 = z0_base + sin_a * inset + handrail_h - top_rail_h_mm
                rx0 = x1 - cos_a * inset;  rz0 = z1_base - sin_a * inset + bot_rail_h_mm
                rx1 = x1 - cos_a * inset;  rz1 = z1_base - sin_a * inset + handrail_h - top_rail_h_mm

                catch_frame_lines.append(rg.Line(rg.Point3d(lx0, side_y, lz0), rg.Point3d(rx0, side_y, rz0)))
                catch_frame_lines.append(rg.Line(rg.Point3d(lx1, side_y, lz1), rg.Point3d(rx1, side_y, rz1)))
                catch_frame_lines.append(rg.Line(rg.Point3d(lx0, side_y, lz0), rg.Point3d(lx1, side_y, lz1)))
                catch_frame_lines.append(rg.Line(rg.Point3d(rx0, side_y, rz0), rg.Point3d(rx1, side_y, rz1)))

    # ── CNC flat panels ───────────────────────────────────────────────────────
    cnc_start_x = ox + total_run + 800
    cnc_gap     = panel_s_edge + 200
    s_off       = panel_h_mm * math.tan(slope_rad)

    for i in range(tot_panels):
        px = cnc_start_x + i * cnc_gap
        py = oy

        BL = rg.Point3d(px,                      py, oz)
        BR = rg.Point3d(px + panel_s_edge,        py, oz)
        TR = rg.Point3d(px + panel_s_edge - s_off, py, oz + panel_h_mm)
        TL = rg.Point3d(px - s_off,               py, oz + panel_h_mm)

        srf = rg.NurbsSurface.CreateFromCorners(BL, BR, TR, TL)
        if srf:
            cnc_panels.append(srf)

        brect = rg.NurbsSurface.CreateFromCorners(
            rg.Point3d(px - s_off - 50,         py, oz - 50),
            rg.Point3d(px + panel_s_edge + 50,  py, oz - 50),
            rg.Point3d(px + panel_s_edge + 50,  py, oz + panel_h_mm + 50),
            rg.Point3d(px - s_off - 50,         py, oz + panel_h_mm + 50)
        )
        if brect:
            cnc_bounding_rects.append(brect)

    # ── Report ────────────────────────────────────────────────────────────────
    sheet_fits    = (sheet_w >= panel_bw) and (sheet_h_val >= panel_bh)
    sheet_fit_msg = (
        "OK — panel fits in sheet ({:.0f}×{:.0f}mm < {:.0f}×{:.0f}mm)".format(
            panel_bw, panel_bh, sheet_w, sheet_h_val)
        if sheet_fits else
        "WARNING: panel bounding rect ({:.0f}×{:.0f}mm) exceeds sheet ({:.0f}×{:.0f}mm)!".format(
            panel_bw, panel_bh, sheet_w, sheet_h_val)
    )
    catch_slope_edge_m = panel_s_edge / 1000.0
    catch_height_m2    = panel_h_mm   / 1000.0
    catch_total_m      = round(num_panels_frame * sides * 2 * (catch_slope_edge_m + catch_height_m2), 2)

    infill_label = "framed post glass {}mm".format(int(glass_thick)) if str(infill_type) == "glass" else str(infill_type)

    report = (
        "=== BRILLIANT METAL WORKS — STAIRCASE RAILING ===\n"
        "Project: {}\n"
        "\n"
        "STAIRCASE\n"
        "  Rise: {:.0f}mm  Run: {:.0f}mm  Width: {:.0f}mm\n"
        "  Stringer: {:.0f}mm  Slope: {:.1f} deg\n"
        "  Steps: {} × {:.0f}mm rise / {:.0f}mm going\n"
        "\n"
        "HANDRAIL ({})\n"
        "  Posts: {}   Panels: {} per side   Sides: {}\n"
        "  Rail height: {:.0f}mm\n"
        "  Post: {}  Top rail: {}  Bottom rail: {}\n"
        "\n"
        "INNER CATCH FRAME ({})\n"
        "  Approx. total length: {:.2f}m\n"
        "\n"
        "CNC PANEL DIMENSIONS (ALL IDENTICAL)\n"
        "  Slope edge:   {:.0f}mm   Height: {:.0f}mm\n"
        "  Interior angle: {:.1f} deg\n"
        "  Bounding rect:  {:.0f} × {:.0f}mm\n"
        "  Total panels:   {}\n"
        "  Sheet: {:.0f} × {:.0f}mm  — {}\n"
        "\n"
        "Generated by Brilliant Metal Works System\n"
    ).format(
        project_code or "N/A",
        total_rise, total_run, width,
        float(stringer_length or 0), slope_deg,
        num_steps, step_r, step_g,
        infill_label,
        post_count, num_panels_frame, rail_sides or "one",
        handrail_h,
        post_profile or "40x40",
        top_rail_profile or "40x40",
        bottom_rail_profile or "40x20",
        catch_profile or "20x20",
        catch_total_m,
        panel_s_edge, panel_h_mm,
        panel_ang,
        panel_bw, panel_bh,
        tot_panels,
        sheet_w, sheet_h_val, sheet_fit_msg,
    )
