"""Compatibility entry for outfit restoration; footwear has one shared builder."""
import runpy
from pathlib import Path

def repair_garden_shoes():
 runpy.run_path(str(Path(__file__).with_name('shoes.py')))['replace_shoes'](('garden',))
