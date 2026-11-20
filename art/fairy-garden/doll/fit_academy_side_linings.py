"""Fit the academy's body-bound side panels to the argyle shirt and cross-collar robe."""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np

from body_shape import deform
from repair_collar_strap import read_glb, write_glb


def cut_sleeve_swatch(source):
    """Clip the front of the original right sleeve, retaining each face's UV chart."""
    decoder = Path(__file__).with_name('decode_shirt_patch.cjs')
    donor = json.loads(subprocess.check_output(['node', decoder, source]))
    positions = np.asarray(donor['POSITION']).reshape(-1, 3)
    uv = np.asarray(donor['TEXCOORD_0']).reshape(-1, 2)
    vertices, faces = [], []
    for face in donor['faces']:
        tri = positions[face]
        if tri[:, 2].max() < .018 or np.cross(tri[1]-tri[0], tri[2]-tri[0])[2] <= 0:
            continue
        polygon = list(np.c_[tri, uv[face]])
        for axis, limit, sign in [(0,.152,1),(0,.202,-1),(1,.548,1),(1,.622,-1)]:
            clipped = []
            for i, end in enumerate(polygon):
                start = polygon[i-1]
                da, db = sign*(start[axis]-limit), sign*(end[axis]-limit)
                if (da < 0) != (db < 0):
                    clipped.append(start+(end-start)*(da/(da-db)))
                if db >= 0:
                    clipped.append(end)
            polygon = clipped
        if len(polygon) >= 3:
            first = len(vertices)
            vertices.extend(polygon)
            faces.extend((first,first+j,first+j+1) for j in range(1,len(polygon)-1))
    # Subdivide before draping: a long original triangle otherwise spans a
    # curved seam as a straight chord. Interpolate UVs within its source face.
    points = np.asarray(vertices)
    triangles = np.asarray(faces)
    while True:
        refined = []
        split = False
        for tri in points[triangles]:
            outline = []
            for start,end in zip(tri,tri[[1,2,0]]):
                outline.append(start)
                if np.linalg.norm(end[:2]-start[:2]) > .007:
                    outline.append((start+end)*.5)
            if len(outline) == 3:
                refined.append(tri)
            else:
                split = True
                center = tri.mean(axis=0)
                refined.extend((v,outline[(j+1)%len(outline)],center)
                               for j,v in enumerate(outline))
        if not split:
            break
        points, ids = np.unique(np.asarray(refined).reshape(-1,5).round(8),
                                axis=0,return_inverse=True)
        triangles = ids.reshape(-1,3)
    return points, triangles


def fit(source, output, outfit):
    doc, blob = read_glb(source)
    if any(node['name'].startswith('outfit_'+outfit+'_side_') for node in doc['nodes']):
        raise ValueError('Side lining already installed')
    slot = 'trim' if outfit=='argyle' else 'cloth'
    shirt = next(n for n in doc['nodes'] if n['name'] == f'outfit_{outfit}_{slot}')
    mesh = doc['meshes'][shirt['mesh']]
    material = mesh['primitives'][0]['material']
    body = next(i for i,n in enumerate(doc['nodes']) if n['name'] == 'body')
    joint = doc['skins'][shirt['skin']]['joints'].index(body)
    parent = next(n for n in doc['nodes'] if doc['nodes'].index(shirt) in n.get('children', []))

    swatch = cut_sleeve_swatch(source) if outfit == 'argyle' else None
    shared_accessors = {}

    def store(values, kind='VEC3', dtype='<f4', component=5126):
        values = np.asarray(values, dtype=dtype)
        key = (kind, dtype, component, values.shape, values.tobytes())
        if key in shared_accessors:
            return shared_accessors[key]
        blob.extend(bytes(-len(blob) % 4))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append(dict(buffer=0, byteOffset=len(blob), byteLength=values.nbytes))
        blob.extend(values.tobytes())
        accessor = dict(bufferView=view, componentType=component, count=len(values), type=kind)
        if kind == 'VEC3':
            accessor.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
        doc['accessors'].append(accessor)
        shared_accessors[key] = len(doc['accessors'])-1
        return shared_accessors[key]

    # Dome the upper edge into the sleeve cavity and overlap the lower
    # edge beneath the vest. Coordinates are in the garment's glTF space.
    profile = [(.478,.095,.054),(.495,.108,.067),(.515,.114,.075),
               (.54,.116,.077),(.57,.117,.076),(.60,.119,.072),
               (.625,.117,.066),(.644,.112,.060),(.66,.102,.05),
               (.674,.084,.036)]
    if outfit == 'bamboo':
        profile = [(.465,.085,.051),(.48,.096,.059),(.50,.101,.062),
                   (.53,.106,.068),(.56,.109,.069),(.59,.108,.064),
                   (.615,.103,.058),(.636,.094,.052),(.65,.083,.042)]
        # Carry the underarm cloth under the sash, then gather it into
        # a shallow diagonal fold where the raised sleeve reveals it.
        profile.insert(0,(.451,.090,.056))
        table = np.asarray(profile)
        heights = np.linspace(table[0,0], table[-1,0], 67)
        profile = np.c_[heights, np.interp(heights,table[:,0],table[:,1]),
                        np.interp(heights,table[:,0],table[:,2])]
    angles = np.linspace(-1.42,1.42,73 if outfit == 'argyle' else 49)
    cols = len(angles)
    for side, sign in [('left',-1),('right',1)]:
        p = np.array([[sign*rx*np.cos(a)**.65,y,-.005+rz*np.sin(a)]
                      for y,rx,rz in profile for a in angles])
        if outfit == 'argyle':
            # Lay the three materials on one surface, sharing both rim edges.
            # The top of the vest climbs up the front/back and dips below the arm.
            table = np.asarray(profile)
            lateral = np.sin(angles)
            edge = .541 + .105 * (1 - np.exp(-(np.abs(lateral)/.81)**3))
            width = .016 + .014 * np.abs(lateral)
            lo, hi = edge-width/2, edge+width/2
            levels = [.478+np.zeros(cols), (.478+lo)/2, lo,
                      lo+.22*width, edge, hi-.22*width, hi,
                      hi+.25*(.674-hi), hi+.55*(.674-hi),
                      hi+.80*(.674-hi), .674+np.zeros(cols)]
            rows = []
            texcoords = []
            for j, y in enumerate(levels):
                rx = np.interp(y, table[:,0], table[:,1])
                rz = np.interp(y, table[:,0], table[:,2])
                # Shallow raised ribs around the binding, tapering into both seams.
                relief = 0.
                if 2 < j < 6:
                    relief = (.0028+.00125*np.cos(np.arange(cols)*np.pi)) * (1 if j==4 else .72)
                if 7 <= j <= 9:
                    along = (y-hi)/(.674-hi)
                    relief = -.002*np.sin(np.pi*along)
                rows.append(np.c_[sign*(rx+relief)*np.cos(angles)**.65,
                                  y, -.005+(rz+relief)*lateral])
                texcoords.extend(np.c_[.1715+.018*lateral, .812+.13*(y-.60)])
            p = np.concatenate(rows)
        else:
            a = np.tile(angles,len(profile))
            y = p[:,1]
            t = (y-.451)/(.65-.451)
            # Two overlapping, oblique folds fan out from the sash. Return
            # the crest over its recess so it casts a narrow cloth shadow.
            across = np.sin(a)
            height = y-.488-.033*across
            side_fade = np.cos(a)**2 * np.clip((y-.451)/.018,0,1)
            rolled = np.exp(-(height/.009)**2)
            second = np.exp(-((height-.030)/.012)**2)
            recess = np.exp(-((height+.009)/.010)**2)
            relief = side_fade*(.006*rolled+.004*second-.012*recess-.003)
            p[:,1] -= side_fade*(.009*rolled+.004*second)
            p[:,0] += sign*relief*np.cos(a)
            p[:,2] += relief*np.sin(a)
            # Map a continuous swatch of the robe's plain fabric atlas
            # lengthwise, retaining its baked cloth and normal detail.
            texcoords = np.c_[.278+.058*a/1.42,.158-.124*t]
        faces = []
        for i in range(len(p)//cols-1):
            for j in range(cols-1):
                k = i*cols+j
                faces += [(k,k+cols,k+1),(k+1,k+cols,k+cols+1)]
        faces = np.array(faces)[:,::sign]
        normal = np.zeros_like(p)
        cross = np.cross(p[faces[:,1]]-p[faces[:,0]],p[faces[:,2]]-p[faces[:,0]])
        for col in faces.T:
            np.add.at(normal,col,cross)
        normal /= np.linalg.norm(normal,axis=1)[:,None]
        attrs = dict(POSITION=store(p), NORMAL=store(normal),
                     TEXCOORD_0=store(texcoords, 'VEC2'),
                     JOINTS_0=store(np.tile([joint,0,0,0],(len(p),1)), 'VEC4','<u2',5123),
                     WEIGHTS_0=store(np.tile([1,0,0,0],(len(p),1)), 'VEC4'))
        xyz = np.c_[p[:,0],-p[:,2],p[:,1]]
        targets = []
        for key in mesh['extras']['targetNames']:
            delta = deform(xyz,np.zeros(len(p)),key,True)
            targets.append(dict(POSITION=store(np.c_[delta[:,0],delta[:,2],-delta[:,1]])))
        primitive = dict(attributes=attrs,indices=store(faces.ravel(),'SCALAR','<u2',5123),
                         material=material,mode=4,targets=targets)
        name = f'outfit_{outfit}_side_{side}'
        node = dict(name=name,mesh=len(doc['meshes']),skin=shirt['skin'],
                    extras=dict(outfit=outfit,colorSlot=slot,dyeTexture=True))
        doc['meshes'].append(dict(name=name,primitives=[primitive],weights=mesh['weights'],
                                  extras=mesh['extras']))
        parent['children'].append(len(doc['nodes']))
        doc['nodes'].append(node)
        if outfit == 'argyle':
            # Continue the vest around the rib cage. Leave the upper part of
            # the same side panel in shirt fabric, where it meets the sleeve.
            vest = next(n for n in doc['nodes'] if n['name'] == 'outfit_argyle_cloth')
            knit = doc['meshes'][vest['mesh']]['primitives'][0]['material']
            # Rows 2 through 6 are the raised knit binding. Map its fold
            # across the darker/lighter yarn on the actual vest atlas.
            bottom = faces.max(axis=1) < 7 * cols
            primitive['indices'] = store(faces[~bottom].ravel(), 'SCALAR', '<u2', 5123)
            knit_uv = np.c_[.065 + .24*p[:,2], .045 + .12*(.60-p[:,1])]
            for row_index, v in enumerate((.046,.030,.020,.026,.041), start=2):
                span = slice(row_index*cols,(row_index+1)*cols)
                knit_uv[span,0] = .080+.016*lateral
                knit_uv[span,1] = v
            gusset = dict(primitive, material=knit,
                          attributes=dict(attrs, TEXCOORD_0=store(knit_uv, 'VEC2')),
                          indices=store(faces[bottom].ravel(), 'SCALAR', '<u2', 5123))
            panel_name = f'outfit_argyle_vest_side_{side}'
            parent['children'].append(len(doc['nodes']))
            doc['nodes'].append(dict(name=panel_name, mesh=len(doc['meshes']), skin=shirt['skin'],
                                     extras=dict(outfit=outfit, colorSlot='cloth', dyeTexture=True)))
            doc['meshes'].append(dict(name=panel_name, primitives=[gusset], weights=mesh['weights'],
                                      extras=mesh['extras']))
            # Sew a separate copy of the sleeve into the opening. Its lower
            # allowance slips beneath the rib; its top overlaps the moving sleeve.
            donor, triangles = swatch
            a = ((donor[:,0]-.152)/.050*2-1)*1.42
            t = np.clip((donor[:,1]-.548)/.074, 0, 1)
            lateral = np.sin(a)
            hem = .541+.105*(1-np.exp(-(np.abs(lateral)/.81)**3))+.5*(.016+.014*np.abs(lateral))
            y = hem-.004+t*(.679-hem+.004)
            # Preserve the donor's crown and gather its surplus against the rib.
            plane = np.c_[np.ones(len(t)),a,t]
            crown = donor[:,2] - plane @ np.linalg.lstsq(plane, donor[:,2], rcond=None)[0]
            fullness = np.sin(np.pi*t)*(.009+.007*np.cos(5*a-2.5*t)+crown)
            offset = .002+fullness-.005*np.exp(-((t/.065)**2))
            rx = np.interp(y,table[:,0],table[:,1])+offset
            rz = np.interp(y,table[:,0],table[:,2])+offset
            patch = np.c_[sign*rx*np.cos(a)**.65,y,-.005+rz*lateral]
            indices = triangles[:,::-1] if sign == 1 else triangles
            # Average normals across source UV splits without merging those UVs.
            keys, inverse = np.unique(np.round(patch,6), axis=0, return_inverse=True)
            averaged = np.zeros_like(keys)
            cross = np.cross(patch[indices[:,1]]-patch[indices[:,0]],patch[indices[:,2]]-patch[indices[:,0]])
            for col in indices.T:
                np.add.at(averaged,inverse[col],cross)
            averaged /= np.maximum(np.linalg.norm(averaged,axis=1)[:,None],1e-12)
            upper = doc['skins'][shirt['skin']]['joints'].index(next(i for i,n in enumerate(doc['nodes'])
                if n['name'] == ('rightArm' if sign>0 else 'leftArm')))
            # The swatch is held by the torso at the seam and by the sleeve above.
            arm = .22*t*t
            patch_attrs = dict(POSITION=store(patch),NORMAL=store(averaged[inverse]),
                TEXCOORD_0=store(donor[:,3:5],'VEC2'),
                JOINTS_0=store(np.tile([joint,upper,0,0],(len(t),1)),'VEC4','<u2',5123),
                WEIGHTS_0=store(np.c_[1-arm,arm,np.zeros((len(t),2))],'VEC4'))
            xyz = np.c_[patch[:,0],-patch[:,2],patch[:,1]]
            morphs = []
            for key in mesh['extras']['targetNames']:
                delta = deform(xyz,arm,key,True)
                morphs.append(dict(POSITION=store(np.c_[delta[:,0],delta[:,2],-delta[:,1]])))
            name = f'outfit_argyle_sleeve_insert_{side}'
            parent['children'].append(len(doc['nodes']))
            doc['nodes'].append(dict(name=name,mesh=len(doc['meshes']),skin=shirt['skin'],
                extras=dict(outfit=outfit,colorSlot=slot,dyeTexture=True)))
            doc['meshes'].append(dict(name=name,weights=mesh['weights'],extras=mesh['extras'],
                primitives=[dict(attributes=patch_attrs,indices=store(indices.ravel(),'SCALAR','<u2',5123),
                                 mode=4,material=material,targets=morphs)]))
    write_glb(output,doc,blob)


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('source',type=Path)
    cli.add_argument('output',type=Path)
    cli.add_argument('outfit',choices=['argyle','bamboo'])
    args = cli.parse_args()
    fit(args.source,args.output,args.outfit)
