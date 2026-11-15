"""Shared smooth hair deformation with UV-seam-safe custom normal transport."""
import numpy as np

def deform_mesh(mesh, deform):
    points = np.array([vertex.co[:] for vertex in mesh.vertices])
    normals = np.array([normal.vector[:] for normal in mesh.corner_normals])
    loop_vertices = np.array([loop.vertex_index for loop in mesh.loops])
    result = deform(points)
    jacobian = np.empty((len(points), 3, 3))
    epsilon = 1e-4
    for axis in range(3):
        delta = np.zeros_like(points)
        delta[:, axis] = epsilon
        jacobian[:, :, axis] = (deform(points + delta) - deform(points - delta)) / (2 * epsilon)
    determinant = np.linalg.det(jacobian)
    assert np.isfinite(result).all() and determinant.min() > .1, 'Folded hair deformation'
    inverse_transpose = np.linalg.inv(jacobian[loop_vertices]).transpose(0, 2, 1)
    normals = np.einsum('nij,nj->ni', inverse_transpose, normals)
    normals /= np.maximum(1e-12, np.linalg.norm(normals, axis=1))[:, None]
    for vertex, coordinate in zip(mesh.vertices, result):
        vertex.co = coordinate
    mesh.update()
    mesh.normals_split_custom_set(normals.tolist())
    return {'vertices': len(points), 'triangles': sum(len(p.vertices)-2 for p in mesh.polygons),
            'jacobianMin': float(determinant.min()), 'jacobianMax': float(determinant.max()),
            'finite': bool(np.isfinite(result).all())}
