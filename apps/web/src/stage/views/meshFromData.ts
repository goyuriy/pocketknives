import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Node } from '@babylonjs/core/node';
import type { Material } from '@babylonjs/core/Materials/material';
import type { MeshData } from '../math/meshData.js';

/** Hands engine-free triangles to the GPU as a mesh. */
export const meshFromData = (
  scene: Scene,
  name: string,
  data: MeshData,
  material: Material,
  parent: Node | null = null,
): Mesh => {
  const mesh = new Mesh(name, scene);
  const vertices = new VertexData();
  vertices.positions = [...data.positions];
  vertices.normals = [...data.normals];
  vertices.indices = [...data.indices];
  vertices.applyToMesh(mesh);
  mesh.material = material;
  mesh.parent = parent;
  return mesh;
};
