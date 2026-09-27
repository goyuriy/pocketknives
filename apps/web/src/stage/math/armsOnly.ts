/**
 * Splitting a skinned character into its arms and the rest, so that from the
 * thrower's own eyes only the arms are drawn.
 *
 * A first-person camera sits inside the head, just above the chest, and a
 * whole body seen from there is a mess of shoulders and chest and knees in the
 * bottom of the view. Games show only the arms. The character is one mesh,
 * though, so this sorts its triangles: those that move with the arm bones
 * first, everything else after, and a renderer can then draw the first part
 * alone.
 */

/** How many bones can move one vertex, in the usual four-bone skinning layout. */
const INFLUENCES = 4;

/** The bone that moves a vertex most. */
const strongestBone = (influences: ArrayLike<number>, weights: ArrayLike<number>, vertex: number): number => {
  let best = influences[vertex * INFLUENCES] ?? -1;
  let heaviest = weights[vertex * INFLUENCES] ?? 0;
  for (let slot = 1; slot < INFLUENCES; slot++) {
    const weight = weights[vertex * INFLUENCES + slot] ?? 0;
    if (weight > heaviest) {
      heaviest = weight;
      best = influences[vertex * INFLUENCES + slot] ?? best;
    }
  }
  return best;
};

/**
 * The triangles of a skinned mesh reordered arms first, and how many indices
 * the arms take. A triangle is the arms' when every one of its corners is
 * moved mostly by an arm bone; one that straddles the shoulder stays with the
 * body, so the arms end cleanly where the sleeve would.
 *
 * Pure.
 *
 * @param indices    three vertex indices per triangle
 * @param influences four bone indices per vertex
 * @param weights    four bone weights per vertex, matching `influences`
 * @param isArm      whether a bone index is one of the arms'
 */
export const armsFirst = (
  indices: ArrayLike<number>,
  influences: ArrayLike<number>,
  weights: ArrayLike<number>,
  isArm: (bone: number) => boolean,
): { indices: number[]; arms: number } => {
  const armVertex = new Map<number, boolean>();
  const onArm = (vertex: number) => {
    let known = armVertex.get(vertex);
    if (known === undefined) {
      known = isArm(strongestBone(influences, weights, vertex));
      armVertex.set(vertex, known);
    }
    return known;
  };
  const arms: number[] = [];
  const rest: number[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const corners = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
    (corners.every(onArm) ? arms : rest).push(...corners);
  }
  return { indices: [...arms, ...rest], arms: arms.length };
};

/**
 * The bones drawn from the thrower's own eyes, by Mixamo's names: the whole
 * arm — upper arm, forearm, hand and fingers — so the elbow is there whenever
 * the arm swings into view. Not the shoulder, which sits beside the eyes.
 */
export const isArmBoneName = (name: string): boolean => /^(Left|Right)(Arm|ForeArm|Hand)/.test(name);

/**
 * The same, for a mannequin's joint balls. The shoulder ball rides the upper
 * arm bone but sits right under the eyes, a dark disc filling each bottom
 * corner whenever the view looks down; the elbow ball rides the forearm and
 * stays.
 */
export const isArmJointBoneName = (name: string): boolean => /^(Left|Right)(ForeArm|Hand)/.test(name);
