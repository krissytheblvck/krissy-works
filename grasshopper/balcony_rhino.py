# -*- coding: utf-8 -*-
"""
Brilliant Metal Works - Balcony Geometry (Standalone)
1. Edit the json_path line below with your file path
2. In Rhino command bar type: RunPythonScript
3. Browse to this file and open it - geometry appears in viewport
"""

import json
import os
import rhinoscriptsyntax as rs

# --- PASTE YOUR FILE PATH HERE ---
json_path = r"C:\Users\Christian's Laptop\Downloads\BAL-001_Main_Area_grasshopper.json"
# ---------------------------------

if not os.path.exists(json_path):
    print("ERROR: File not found:")
    print(json_path)
else:
    with open(json_path) as f:
        data = json.load(f)

    geo   = data.get("geometry", {})
    prof  = data.get("profiles", {})
    infil = data.get("infill",   {})

    L = float(geo.get("length", 6000))
    H = float(geo.get("height", 1000))
    N = int(geo.get("num_sections") or 0)
    project_code = str(data.get("project_id", "BAL"))

    infill_type  = str(infil.get("type", "plain_sheet"))
    panel_layout = str(infil.get("panel_layout", "full_height"))
    panel_h_mm   = float(infil.get("panel_height_mm") or 0)
    gap_top      = float(infil.get("panel_gap_top_mm") or 0)
    glass_system = str(infil.get("glass_system") or "framed_post")
    panel_w_mm   = float(infil.get("panel_width_mm") or 0)
    bar_spacing  = float(infil.get("bar_spacing") or 100)

    def dim(profile, axis=1):
        try: return float(str(profile).split("x")[axis])
        except: return 40.0

    top_h  = dim(prof.get("top_rail",    "40x40"))
    bot_h  = dim(prof.get("bottom_rail", "40x20"))
    post_w = dim(prof.get("post",        "40x40"))

    if N == 0:
        N = max(1, int(round(L / 1500)))
    sw = L / N

    # Layers
    def make_layer(name, r, g, b):
        full = "{}_{}".format(project_code, name)
        if rs.IsLayer(full):
            objs = rs.ObjectsByLayer(full)
            if objs: rs.DeleteObjects(objs)
        else:
            rs.AddLayer(full, (r, g, b))
        return full

    L_post  = make_layer("Posts",  255, 140,   0)
    L_rail  = make_layer("Rails",   0, 150, 255)
    L_panel = make_layer("Panels", 180, 180, 180)
    L_catch = make_layer("Catch",    0, 200, 100)
    L_glass = make_layer("Glass",  150, 210, 255)
    L_bar   = make_layer("Bars",   220, 100, 100)

    created = []

    def add(obj, layer):
        if obj:
            rs.ObjectLayer(obj, layer)
            created.append(obj)

    # Posts
    for i in range(N + 1):
        x = i * sw
        add(rs.AddLine([x,0,0], [x,0,H]), L_post)

    # Bottom rail
    add(rs.AddLine([0,0,0], [L,0,0]), L_rail)

    # Top rail
    add(rs.AddLine([0,0,H], [L,0,H]), L_rail)

    # Infill
    opening_h = H - top_h - bot_h

    if infill_type == "plain_sheet":
        if panel_layout == "inset" and panel_h_mm > 0:
            eff_h = panel_h_mm
            gap_b = opening_h - panel_h_mm - gap_top
            pz0   = bot_h + gap_b
        else:
            eff_h = opening_h
            gap_top = gap_b = 0
            pz0 = bot_h

        pz1 = pz0 + eff_h
        OVERLAP = 15

        for i in range(N):
            x0 = i * sw
            x1 = x0 + sw
            oz0, oz1 = bot_h, H - top_h
            add(rs.AddPolyline([[x0,0,oz0],[x1,0,oz0],[x1,0,oz1],[x0,0,oz1],[x0,0,oz0]]), L_panel)
            cx0, cx1 = x0 + post_w - OVERLAP, x1 - post_w + OVERLAP
            add(rs.AddPolyline([[cx0,0,pz0],[cx1,0,pz0],[cx1,0,pz1],[cx0,0,pz1],[cx0,0,pz0]]), L_catch)

    elif infill_type == "glass":
        if glass_system == "framed_post":
            for i in range(N):
                x0, x1 = i * sw + post_w, (i+1) * sw - post_w
                z0, z1 = bot_h, H - top_h
                add(rs.AddSrfPt([[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]]), L_glass)
        else:
            pw = panel_w_mm if panel_w_mm > 0 else sw
            n_panels = max(1, int(round(L / pw)))
            z0, z1 = 0, H
            for i in range(n_panels):
                x0, x1 = i * pw, min((i+1) * pw, L)
                add(rs.AddSrfPt([[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]]), L_glass)

    elif infill_type == "flat_bars":
        n_bars = max(1, int(opening_h / bar_spacing))
        for i in range(N):
            x0 = i * sw + post_w
            x1 = (i+1) * sw - post_w
            for b in range(n_bars + 1):
                z = bot_h + b * bar_spacing
                if z > H - top_h: break
                add(rs.AddLine([x0,0,z], [x1,0,z]), L_bar)

    if created:
        rs.SelectObjects(created)
        rs.ZoomSelected()

    print("=" * 50)
    print("OK  {}".format(project_code))
    print("    Length : {}mm".format(int(L)))
    print("    Height : {}mm".format(int(H)))
    print("    Sections : {}  Posts : {}".format(N, N+1))
    print("    Infill : {}".format(infill_type))
    if panel_layout == "inset" and panel_h_mm > 0:
        print("    Panel : {}mm inset  gap-top {}mm".format(int(panel_h_mm), int(gap_top)))
    print("    {} objects created".format(len(created)))
    print("=" * 50)
