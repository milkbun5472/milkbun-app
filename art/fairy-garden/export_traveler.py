"""Export the reference clay doll and its shared wardrobe/shape catalog.
Blender --background --python art/fairy-garden/export_traveler.py
The immutable clay-reference.glb input is never the runtime output.
"""
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,HERE)
import clay_doll
OUT=os.path.abspath(os.path.join(HERE,'..','..','apps','fairy-garden','doll.glb'))
clay_doll.export(OUT)
