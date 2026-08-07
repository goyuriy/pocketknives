import { useMemo } from 'react';
import { Shape, ExtrudeGeometry } from 'three';
import type { KnifeSpec } from '@pocketknives/core';

/**
 * A knife, built from its silhouette.
 *
 * Extruding a flat profile gives a blade with real edges and a readable
 * broadside for the cost of a couple of dozen triangles — and the broadside is
 * the point. The whole mechanic asks the player to read the tumble in flight, so
 * the knife has to look obviously different edge-on and flat-on. A cylinder or a
 * box would not.
 *
 * The model points along `+x` with its balance point at the origin, which is
 * where the flight puts it.
 */
export const Knife = ({ spec, dimmed = false }: { spec: KnifeSpec; dimmed?: boolean }) => {
  const { bladeLength, handleLength, balance, edgeWidth } = spec;
  // The model is built about the balance point, because that is what the flight
  // tracks and what the knife visibly turns around.
  const tip = (1 - balance) * (bladeLength + handleLength);
  const butt = tip - (bladeLength + handleLength);
  const shoulder = tip - bladeLength;
  const halfEdge = Math.max(edgeWidth, 0.006) / 2;

  const bladeGeometry = useMemo(() => {
    const blade = new Shape();
    blade.moveTo(shoulder, -0.055);
    blade.lineTo(tip - bladeLength * 0.3, -0.05);
    blade.lineTo(tip, 0); // the point
    blade.lineTo(tip - bladeLength * 0.3, 0.05);
    blade.lineTo(shoulder, 0.055);
    blade.closePath();
    return standUpright(
      new ExtrudeGeometry(blade, { depth: halfEdge * 2, bevelEnabled: false }),
      halfEdge * 2,
    );
  }, [shoulder, tip, bladeLength, halfEdge]);

  const handleGeometry = useMemo(() => {
    const handle = new Shape();
    handle.moveTo(butt, -0.045);
    handle.lineTo(shoulder + 0.02, -0.062);
    handle.lineTo(shoulder + 0.02, 0.062);
    handle.lineTo(butt, 0.045);
    handle.closePath();
    return standUpright(new ExtrudeGeometry(handle, { depth: 0.05, bevelEnabled: false }), 0.05);
  }, [butt, shoulder]);

  return (
    <group>
      <mesh geometry={bladeGeometry} castShadow>
        <meshStandardMaterial
          color={dimmed ? '#7d8590' : '#d9dee4'}
          metalness={0.85}
          roughness={0.28}
        />
      </mesh>
      <mesh geometry={handleGeometry} castShadow>
        <meshStandardMaterial color={dimmed ? '#3a2b22' : '#5a3d2b'} roughness={0.85} />
      </mesh>
    </group>
  );
};

/**
 * Stands the extruded silhouette on edge.
 *
 * A shape is drawn in the xy plane and extruded along +z, which would leave the
 * knife lying flat with its broad face to the sky. The blade has to stand in the
 * vertical plane it tumbles through, so the profile is tipped upright and the
 * thickness becomes its sideways width. Centring that thickness first keeps the
 * knife turning about itself rather than about one of its faces.
 */
const standUpright = (geometry: ExtrudeGeometry, depth: number): ExtrudeGeometry => {
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(Math.PI / 2);
  return geometry;
};
