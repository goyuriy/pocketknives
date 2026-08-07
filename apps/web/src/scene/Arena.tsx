import { useMemo } from 'react';
import { DoubleSide, Shape, ShapeGeometry } from 'three';
import type { Board, FieldOutline, Ring, Vec2 } from '@pocketknives/core';
import { colorOf } from '../ui/theme.js';

/** Heights are in game units and tiny — this is chalk on dirt, not terrain. */
const GROUND = 0;
const TERRITORY = 0.012;
const BORDER = 0.03;
const CUT = 0.045;

const ringShape = (ring: Ring): Shape => {
  const shape = new Shape();
  ring.forEach(([x, y], index) => (index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
};

/**
 * The ground a player holds, drawn as one shape per connected field.
 *
 * Their pieces go into a single geometry rather than one mesh each, for the same
 * reason the flat renderer put them in a single path: a field is what the player
 * sees, and drawing its parts separately would show seams across ground that is
 * in fact whole.
 */
const Field = ({ field, dimmed }: { field: FieldOutline; dimmed: boolean }) => {
  const geometry = useMemo(
    () => new ShapeGeometry(field.rings.map(ringShape)),
    [field.rings],
  );

  return (
    <mesh geometry={geometry} position={[0, 0, TERRITORY]} receiveShadow>
      <meshStandardMaterial
        color={colorOf(field.ownerId)}
        transparent
        opacity={dimmed ? 0.25 : 0.62}
        roughness={0.95}
        side={DoubleSide}
      />
    </mesh>
  );
};

/**
 * Borders, scratched into the dirt.
 *
 * Only real frontiers are drawn — where a player's ground meets someone else's,
 * or the rim. The opening wedge lines vanish as soon as one player holds both
 * sides of them, because by then they are not borders, just history.
 */
const Borders = ({ fields }: { fields: readonly FieldOutline[] }) => (
  <group position={[0, 0, BORDER]}>
    {fields.map((field, index) => (
      <BorderRibbons key={`${field.ownerId}-${index}`} field={field} />
    ))}
  </group>
);

const BorderRibbons = ({ field }: { field: FieldOutline }) => {
  const geometry = useMemo(() => {
    const shapes = field.segments.map(([a, b]) => ribbon(a, b, 0.075));
    return new ShapeGeometry(shapes);
  }, [field.segments]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={colorOf(field.ownerId)} side={DoubleSide} />
    </mesh>
  );
};

/**
 * A line with width, as a quad.
 *
 * Three's line primitives ignore `lineWidth` on almost every platform, so a
 * border that must read clearly from a low camera has to be actual geometry.
 */
const ribbon = ([ax, ay]: Vec2, [bx, by]: Vec2, width: number): Shape => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);

  const shape = new Shape();
  shape.moveTo(ax + nx, ay + ny);
  shape.lineTo(bx + nx, by + ny);
  shape.lineTo(bx - nx, by - ny);
  shape.lineTo(ax - nx, ay - ny);
  shape.closePath();
  return shape;
};

/** The line the blade laid down, drawn brighter and above the borders. */
export const CutLine = ({ cut, progress }: { cut: readonly [Vec2, Vec2]; progress: number }) => {
  const geometry = useMemo(() => {
    const [from, to] = cut;
    // Grows outward from the middle, the way a crack runs from where it started.
    const midpoint: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const reach = (end: Vec2): Vec2 => [
      midpoint[0] + (end[0] - midpoint[0]) * progress,
      midpoint[1] + (end[1] - midpoint[1]) * progress,
    ];
    return new ShapeGeometry([ribbon(reach(from), reach(to), 0.11)]);
  }, [cut, progress]);

  return (
    <mesh geometry={geometry} position={[0, 0, CUT]}>
      <meshBasicMaterial color="#fff6e0" side={DoubleSide} />
    </mesh>
  );
};

export const Arena = ({
  board,
  fields,
  alive,
}: {
  board: Board;
  fields: readonly FieldOutline[];
  alive: readonly string[];
}) => (
  <group>
    <mesh position={[0, 0, GROUND]} receiveShadow>
      <circleGeometry args={[board.radius * 1.35, 96]} />
      <meshStandardMaterial color="#2a2119" roughness={1} />
    </mesh>

    <mesh position={[0, 0, GROUND + 0.006]} receiveShadow>
      <circleGeometry args={[board.radius, 180]} />
      <meshStandardMaterial color="#453425" roughness={1} />
    </mesh>

    {fields.map((field, index) => (
      <Field
        key={`${field.ownerId}-${index}`}
        field={field}
        dimmed={!alive.includes(field.ownerId)}
      />
    ))}

    <Borders fields={fields} />
  </group>
);
