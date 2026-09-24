"""Open the delivered source in a fresh Blender process and verify portability."""
import bpy,sys,json
from pathlib import Path
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'carriage.blend'))
assert not bpy.data.libraries,'Unexpected linked external library'
assert not [i.filepath for i in bpy.data.images if i.source=='FILE' and not i.packed_file],'Unpacked external texture'
assert len([o for o in bpy.data.objects if o.get('anchor')])==7
for group in ['Interior','ShellFront','ShellEnd','Roof','WindowGlass']:
 assert bpy.data.collections.get(group) and len(bpy.data.collections[group].objects)>0,group
assert bpy.data.objects.get('Puzzle table green felt')
assert bpy.data.objects['Puzzle table green felt'].dimensions.x>1.4
assert bpy.data.objects['Puzzle table green felt'].dimensions.y>1.3
print(json.dumps({'saved_source_reopened':True,'external_libraries':0,'unpacked_textures':0,'anchors':7}))
