"""
Brilliant Metal Works — Balcony Geometry Builder
=================================================
Paste this script into a GHPython component in Grasshopper.
Connect the outputs of balcony_reader.py to the matching inputs here.

INPUTS (wire from balcony_reader.py):
  length          → Number (mm)
  height          → Number (mm)
  num_sections    → Number
  post_count      → Number
  post_profile    → Text
  bottom_rail     → Text
  top_rail        → Text
  catch_profile   → Text
  infill_type     → Text
  sheet_width     → Number (mm)
  sheet_height    → Number (mm)
  panel_layout    → Text  ("full_height" | "inset")
  panel_height    → Number (mm)  — inset only: height of the CNC panel
  panel_gap_top   → Number (mm)  — inset only: gap between top rail and panel top
  glass_system    → Text  ("framed_post" | "spigot" | "channel_base" | "embedded")
  panel_width     → Number (mm)  — width of each glass panel
  glass_thickness → Number (mm)
  project_code    → Text
  origin          → Point3d (optional, default 0,0,0)

OUTPUTS:
  post_lines        → Lines   — vertical steel posts
  bottom_rail_line  → Line    — bottom rail (steel systems) or floor reference line
  top_rail_line     → Line    — top rail / handrail
  panel_frames      → Lines   — outer boundary of each section
  catch_frame_lines → Lines   — inner catch frame (plain_sheet only)
  post_positions    → Points  — base of each post
  glass_surfaces    → Surfaces — glass panel Breps (glass infill only)
  spigot_points     → Points  — spigot base positions (spigot system)
  spigot_lines      → Lines   — spigot rod geometry 150mm tall (spigot system)
  channel_line      → Line    — bottom U-channel full length (channel_base system)
  embed_lines       → Lines   — embedment depth lines 100mm below floor (embedded system)
  quantity_report   → Text
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

# ── Defaults ──────────────────────────────────────────────────────────────────
if not length:          length          = 6200.0
if not height:          height          = 1100.0
if not post_count:      post_count      = 0
if not num_sections:    num_sections    = 0
if not post_profile:    post_profile    = "40x40"
if not bottom_rail:     bottom_rail     = "40x20"
if not top_rail:        top_rail        = "40x40"
if not catch_profile:   catch_profile   = "20x20"
if not infill_type:     infill_type     = "plain_sheet"
if not sheet_width:     sheet_width     = 2000.0
if not sheet_height:    sheet_height    = 1000.0
if not panel_layout:    panel_layout    = "full_height"
if not panel_height:    panel_height    = None
if not panel_gap_top:   panel_gap_top   = 0
if not glass_system:    glass_system    = "framed_post"
if not panel_width:     panel_width     = 1000.0
if not glass_thickness: glass_thickness = 10.0
if not project_code:    project_code    = "N/A"

# Origin
ox, oy, oz = 0.0, 0.0, 0.0
if origin:
    ox = float(origin.X)
    oy = float(origin.Y)
    oz = float(origin.Z)

length          = float(length)
height          = float(height)
num_sections    = int(num_sections)
sheet_width     = float(sheet_width)
sheet_height    = float(sheet_height)
panel_width     = float(panel_width)
glass_thickness = float(glass_thickness)

# Profile dimensions
post_w     = parse_w(post_profile)
top_rail_h = parse_h(top_rail)
bot_rail_h = parse_h(bottom_rail)
catch_w    = parse_w(catch_profile)

# Determine if this is a glass-only (non-framed) system
is_glass_only = (infill_type == "glass" and
                 glass_system in ("spigot", "channel_base", "embedded"))

# ── Empty output lists ─────────────────────────────────────────────────────────
post_lines        = []
post_positions    = []
panel_frames      = []
catch_frame_lines = []
glass_surfaces    = []
spigot_points     = []
spigot_lines      = []
channel_line      = None
embed_lines       = []

# ─────────────────────────────────────────────────────────────────────────────
# BRANCH A — GLASS-ONLY SYSTEMS (spigot / channel_base / embedded)
# No steel posts or catch frame; only glass panels + system-specific hardware
# ─────────────────────────────────────────────────────────────────────────────
if is_glass_only:
    # Evenly distribute panels across the full length
    num_panels    = max(1, int(math.ceil(length / panel_width)))
    actual_pw     = length / num_panels  # distribute evenly
    SPIGOT_H      = 150.0  # typical spigot rod visible height (mm)
    EMBED_DEPTH   = 100.0 if glass_system == "embedded" else 0.0
    CHANNEL_H     = 60.0  if glass_system == "channel_base" else 0.0

    # Glass panel vertical extents
    glass_z_bot = oz - EMBED_DEPTH          # extends below floor for embedded
    glass_z_top = oz + height

    # Top rail (aluminum) along full length at glass top
    top_rail_line = rg.Line(
        rg.Point3d(ox,          oy, glass_z_top),
        rg.Point3d(ox + length, oy, glass_z_top)
    )
    # Bottom reference line at floor level
    bottom_rail_line = rg.Line(
        rg.Point3d(ox,          oy, oz),
        rg.Point3d(ox + length, oy, oz)
    )

    # ── Glass panel surfaces ──────────────────────────────────────────────────
    for i in range(num_panels):
        x0 = ox + i       * actual_pw
        x1 = ox + (i + 1) * actual_pw
        # Gap of 5mm between panels (aesthetic)
        gap  = 5.0 if num_panels > 1 else 0.0
        px0  = x0 + gap / 2.0
        px1  = x1 - gap / 2.0
        # Corner points for glass rectangle (planar in XZ plane)
        p00 = rg.Point3d(px0, oy, glass_z_bot)
        p10 = rg.Point3d(px1, oy, glass_z_bot)
        p11 = rg.Point3d(px1, oy, glass_z_top)
        p01 = rg.Point3d(px0, oy, glass_z_top)
        brep = rg.Brep.CreateFromCornerPoints(p00, p10, p11, p01, 0.001)
        if brep:
            glass_surfaces.append(brep)

    # ── System-specific hardware geometry ─────────────────────────────────────
    if glass_system == "spigot":
        # One spigot at each panel join + both ends = num_panels + 1
        for i in range(num_panels + 1):
            x = ox + i * actual_pw
            base = rg.Point3d(x, oy, oz)
            top  = rg.Point3d(x, oy, oz + SPIGOT_H)
            spigot_points.append(base)
            spigot_lines.append(rg.Line(base, top))

    elif glass_system == "channel_base":
        # Single U-channel line the full length of the railing at floor level
        channel_line = rg.Line(
            rg.Point3d(ox,          oy, oz),
            rg.Point3d(ox + length, oy, oz)
        )

    elif glass_system == "embedded":
        # Show embedment lines at each panel edge going 100mm below floor
        for i in range(num_panels + 1):
            x = ox + i * actual_pw
            top_pt = rg.Point3d(x, oy, oz)
            bot_pt = rg.Point3d(x, oy, oz - EMBED_DEPTH)
            embed_lines.append(rg.Line(top_pt, bot_pt))

    # ── Quantity report ───────────────────────────────────────────────────────
    glass_area_m2 = round(num_panels * (actual_pw / 1000.0) * (height / 1000.0), 3)
    top_rail_m    = round(length / 1000.0, 2)

    sys_labels = {
        "spigot":       "Spigot (Frameless)",
        "channel_base": "Channel Base",
        "embedded":     "Embedded in Slab",
    }
    sys_label = sys_labels.get(glass_system, glass_system)

    hw_detail = ""
    if glass_system == "spigot":
        hw_detail = "  Spigots:       {} pieces (at each panel join + ends)\n".format(num_panels + 1)
    elif glass_system == "channel_base":
        hw_detail = "  Channel:       {:.2f}m  (full length U-channel)\n".format(top_rail_m)
    elif glass_system == "embedded":
        hw_detail = "  Embedment:     {:.0f}mm below floor level\n".format(EMBED_DEPTH)

    extra_note = ""
    if glass_system == "embedded":
        extra_note = "  NOTE: Glass height includes {}mm embed = {:.0f}mm total glass height\n".format(
            int(EMBED_DEPTH), height + EMBED_DEPTH)

    quantity_report = (
        "=== BRILLIANT METAL WORKS — BALCONY (GLASS) ===\n"
        "Project: {}\n"
        "\n"
        "SYSTEM: {}\n"
        "  Total length:  {:.0f}mm = {:.2f}m\n"
        "  Railing height:{:.0f}mm\n"
        "\n"
        "GLASS PANELS ({}mm toughened)\n"
        "  Panel count:   {}\n"
        "  Panel width:   {:.0f}mm (distributed)\n"
        "  Glass area:    {:.3f} m²  (excl. gaps)\n"
        "{}"
        "\n"
        "HARDWARE\n"
        "{}  Top rail:      {:.2f}m\n"
        "{}"
    ).format(
        project_code,
        sys_label,
        length, length / 1000.0,
        height,
        int(glass_thickness),
        num_panels,
        actual_pw,
        glass_area_m2,
        extra_note,
        hw_detail,
        top_rail_m,
        "",
    )

# ─────────────────────────────────────────────────────────────────────────────
# BRANCH B — STEEL FRAME SYSTEMS (plain_sheet / flat_bar / framed_post glass)
# ─────────────────────────────────────────────────────────────────────────────
else:
    # Derive post_count
    if num_sections > 0:
        post_count = num_sections + 1
    else:
        post_count = int(post_count) if post_count else 4
    if post_count < 2:
        post_count = 2

    actual_spacing = length / (post_count - 1)

    # ── Posts ─────────────────────────────────────────────────────────────────
    for i in range(post_count):
        x    = ox + i * actual_spacing
        base = rg.Point3d(x, oy, oz)
        top  = rg.Point3d(x, oy, oz + height)
        post_lines.append(rg.Line(base, top))
        post_positions.append(base)

    # ── Rails ─────────────────────────────────────────────────────────────────
    bottom_rail_line = rg.Line(
        rg.Point3d(ox,          oy, oz),
        rg.Point3d(ox + length, oy, oz)
    )
    top_rail_line = rg.Line(
        rg.Point3d(ox,          oy, oz + height),
        rg.Point3d(ox + length, oy, oz + height)
    )

    # ── Panel outer frames ────────────────────────────────────────────────────
    for i in range(post_count - 1):
        x0 = ox + i       * actual_spacing
        x1 = ox + (i + 1) * actual_spacing
        panel_frames.append(rg.Line(rg.Point3d(x0, oy, oz),          rg.Point3d(x1, oy, oz)))
        panel_frames.append(rg.Line(rg.Point3d(x0, oy, oz + height), rg.Point3d(x1, oy, oz + height)))
        panel_frames.append(rg.Line(rg.Point3d(x0, oy, oz),          rg.Point3d(x0, oy, oz + height)))
        panel_frames.append(rg.Line(rg.Point3d(x1, oy, oz),          rg.Point3d(x1, oy, oz + height)))

    # ── Inner catch frame (plain_sheet only) ──────────────────────────────────
    if infill_type == "plain_sheet":
        # Determine catch frame vertical extents based on layout
        opening_h = height - top_rail_h - bot_rail_h
        if panel_layout == "inset" and panel_height and float(panel_height) > 0:
            # Inset: panel is shorter — position it using gap_top from top rail inner face
            p_h   = float(panel_height)
            g_top = float(panel_gap_top) if panel_gap_top else 0.0
            g_bot = opening_h - p_h - g_top
            # panel top = just below top rail minus gap_top
            catch_z1 = oz + height - top_rail_h - g_top
            catch_z0 = catch_z1 - p_h
        else:
            # Full height: catch fills entire opening
            catch_z0 = oz + bot_rail_h
            catch_z1 = oz + height - top_rail_h
            g_bot    = 0.0

        for i in range(post_count - 1):
            cx0 = ox + i       * actual_spacing + post_w / 2.0
            cx1 = ox + (i + 1) * actual_spacing - post_w / 2.0
            if cx1 > cx0 and catch_z1 > catch_z0:
                catch_frame_lines.append(rg.Line(rg.Point3d(cx0, oy, catch_z0), rg.Point3d(cx1, oy, catch_z0)))
                catch_frame_lines.append(rg.Line(rg.Point3d(cx0, oy, catch_z1), rg.Point3d(cx1, oy, catch_z1)))
                catch_frame_lines.append(rg.Line(rg.Point3d(cx0, oy, catch_z0), rg.Point3d(cx0, oy, catch_z1)))
                catch_frame_lines.append(rg.Line(rg.Point3d(cx1, oy, catch_z0), rg.Point3d(cx1, oy, catch_z1)))

    # ── Glass surfaces (framed_post glass) ────────────────────────────────────
    if infill_type == "glass":
        for i in range(post_count - 1):
            gx0 = ox + i       * actual_spacing + post_w / 2.0
            gx1 = ox + (i + 1) * actual_spacing - post_w / 2.0
            gz0 = oz + bot_rail_h
            gz1 = oz + height - top_rail_h
            if gx1 > gx0 and gz1 > gz0:
                p00 = rg.Point3d(gx0, oy, gz0)
                p10 = rg.Point3d(gx1, oy, gz0)
                p11 = rg.Point3d(gx1, oy, gz1)
                p01 = rg.Point3d(gx0, oy, gz1)
                brep = rg.Brep.CreateFromCornerPoints(p00, p10, p11, p01, 0.001)
                if brep:
                    glass_surfaces.append(brep)

    # ── Quantity report ───────────────────────────────────────────────────────
    panel_count    = post_count - 1
    opening_w_mm   = actual_spacing - post_w
    full_opening_h = height - top_rail_h - bot_rail_h
    # For inset layout, panel height < full opening height
    if panel_layout == "inset" and panel_height and float(panel_height) > 0:
        panel_h_mm = float(panel_height)
        gap_top_mm = float(panel_gap_top) if panel_gap_top else 0.0
        gap_bot_mm = full_opening_h - panel_h_mm - gap_top_mm
    else:
        panel_h_mm = full_opening_h
        gap_top_mm = 0.0
        gap_bot_mm = 0.0
    opening_h_mm   = panel_h_mm
    cut_w_mm       = opening_w_mm + 40
    cut_h_mm       = opening_h_mm + 40
    infill_area_m2 = round(panel_count * opening_w_mm * opening_h_mm / 1e6, 2)
    total_post_m   = round(post_count  * height / 1000.0, 2)
    rail_m         = round(length / 1000.0, 2)
    catch_len_m    = round(panel_count * 2 * (opening_w_mm + opening_h_mm) / 1000.0, 2)

    if infill_type == "plain_sheet":
        pps_normal  = int(sheet_width // cut_w_mm)  * int(sheet_height // cut_h_mm)
        pps_rotated = int(sheet_width // cut_h_mm)  * int(sheet_height // cut_w_mm)
        pps         = max(pps_normal, pps_rotated, 1)
        sheets_needed = int(math.ceil(panel_count / float(pps)))
        layout_note = ""
        if panel_layout == "inset" and panel_h_mm < full_opening_h:
            layout_note = (
                "  Layout:        Inset — {:.0f}mm panel / {:.0f}mm top gap / {:.0f}mm bottom gap\n"
                "  Full opening:  {:.0f}mm\n"
            ).format(panel_h_mm, gap_top_mm, gap_bot_mm, full_opening_h)
        infill_section = (
            "\nINFILL (CNC Steel Sheet)\n"
            "{}  CNC cut size:  {:.0f} × {:.0f}mm  (panel + 2×20mm catch overlap)\n"
            "  Sheet size:    {:.0f} × {:.0f}mm\n"
            "  Panels/sheet:  {}  (nesting)\n"
            "  Sheets needed: {}\n"
            "  Infill area:   {:.2f} m²\n"
        ).format(
            layout_note, cut_w_mm, cut_h_mm,
            sheet_width, sheet_height, pps, sheets_needed, infill_area_m2
        )
    elif infill_type == "glass":
        glass_area_m2 = round(panel_count * opening_w_mm * opening_h_mm / 1e6, 3)
        infill_section = (
            "\nINFILL (glass — framed post, {}mm)\n"
            "  Panel opening: {:.0f} × {:.0f}mm per section\n"
            "  Glass area:    {:.3f} m²\n"
        ).format(int(glass_thickness), opening_w_mm, opening_h_mm, glass_area_m2)
    else:
        infill_section = "\nINFILL: {}\n  Infill area: {:.2f} m²\n".format(
            infill_type, infill_area_m2)

    quantity_report = (
        "=== BRILLIANT METAL WORKS — BALCONY ===\n"
        "Project: {}\n"
        "\n"
        "FRAME\n"
        "  Sections:      {} panels, {} posts\n"
        "  Section width: {:.0f}mm  Post spacing: {:.0f}mm\n"
        "  Posts:         {} × {:.0f}mm = {:.2f}m total  ({})\n"
        "  Bottom rail:   {:.2f}m  ({})\n"
        "  Top rail:      {:.2f}m  ({})\n"
        "\n"
        "INNER CATCH FRAME ({})\n"
        "  Opening:       {:.0f} × {:.0f}mm per panel\n"
        "  Total length:  {:.2f}m  (all 4 sides × {} panels)\n"
        "{}"
    ).format(
        project_code,
        panel_count, post_count,
        actual_spacing, actual_spacing,
        post_count, height, total_post_m, post_profile,
        rail_m, bottom_rail,
        rail_m, top_rail,
        catch_profile,
        opening_w_mm, opening_h_mm,
        catch_len_m, panel_count,
        infill_section
    )
