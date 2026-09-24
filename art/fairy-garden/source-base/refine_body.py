"""Conforming edge splits for body morphs, without sculpting the neutral surface.

New vertices are exact edge midpoints. UVs and custom corner normals interpolate
on the original triangles. Original vertices remain at their original indices.
The head and soles do not request refinement.
"""
import bpy


def refine_body(obj, maximum_edge=.015):
    source = obj.data
    positions = [v.co.copy() for v in source.vertices]
    world = [obj.matrix_world @ p for p in positions]
    uv = source.uv_layers.active
    normals = [n.vector.copy() for n in source.corner_normals]
    # Corners carry attributes separately so UV seams and split normals survive.
    faces = []
    for polygon in source.polygons:
        assert len(polygon.vertices) == 3
        corners = [(source.loops[i].vertex_index, uv.data[i].uv.copy(), normals[i])
                   for i in polygon.loop_indices]
        faces.append((corners, polygon.index))
    original_count = len(positions)
    original_faces = len(faces)
    for step in range(20):
        split_edges = set()
        for corners, _ in faces:
            indices = [c[0] for c in corners]
            z = [world[i].z for i in indices]
            if min(z) >= .98 or max(z) <= .145:
                continue
            for a, b in zip(indices, indices[1:] + indices[:1]):
                if (world[a] - world[b]).length > maximum_edge:
                    split_edges.add(tuple(sorted((a, b))))
        if not split_edges:
            break
        print('BODY_REFINE', step, len(faces), len(split_edges), flush=True)
        midpoints = {}
        for a, b in sorted(split_edges):
            midpoints[a, b] = len(positions)
            positions.append((positions[a] + positions[b]) * .5)
            world.append((world[a] + world[b]) * .5)
        refined = []
        for corners, original in faces:
            mids = []
            for ca, cb in zip(corners, corners[1:] + corners[:1]):
                index = midpoints.get(tuple(sorted((ca[0], cb[0]))))
                mids.append(None if index is None else
                            (index, (ca[1] + cb[1]) * .5, (ca[2] + cb[2]) * .5))
            count = sum(m is not None for m in mids)
            if count == 0:
                pending = [corners]
            elif count == 3:
                a, b, c = corners
                ab, bc, ca = mids
                pending = [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]
            else:
                start = next(i for i in range(3) if mids[i] is not None and
                             (count == 1 or mids[(i + 1) % 3] is not None))
                a, b, c = [corners[(start + i) % 3] for i in range(3)]
                ab = mids[start]
                if count == 1:
                    pending = [[a, ab, c], [ab, b, c]]
                else:
                    bc = mids[(start + 1) % 3]
                    pending = [[ab, b, bc]]
                    if (world[a[0]] - world[bc[0]]).length < (world[ab[0]] - world[c[0]]).length:
                        pending.extend([[a, ab, bc], [a, bc, c]])
                    else:
                        pending.extend([[a, ab, c], [ab, bc, c]])
            refined.extend((tri, original) for tri in pending)
        faces = refined
    else:
        raise RuntimeError('Body edge refinement did not converge')
    mesh = bpy.data.meshes.new('Original traveler — body edges refined')
    mesh.from_pydata(positions, [], [[c[0] for c in tri] for tri, _ in faces])
    for material in source.materials:
        mesh.materials.append(material)
    layer = mesh.uv_layers.new(name=uv.name)
    corner_normals = []
    for polygon, (corners, original) in zip(mesh.polygons, faces):
        polygon.use_smooth = source.polygons[original].use_smooth
        polygon.material_index = source.polygons[original].material_index
        for loop, corner in zip(polygon.loop_indices, corners):
            layer.data[loop].uv = corner[1]
            corner_normals.append(corner[2].normalized())
    mesh.normals_split_custom_set(corner_normals)
    obj.data = mesh
    assert all((mesh.vertices[i].co - source.vertices[i].co).length == 0
               for i in range(original_count))
    return {
        'original_vertices': original_count, 'original_triangles': original_faces,
        'refined_vertices': len(mesh.vertices), 'refined_triangles': len(mesh.polygons),
        'original_vertices_unchanged': True, 'maximum_body_edge': maximum_edge,
        'method': 'Conforming midpoint splits; source surface and interpolated UVs retained.',
    }
