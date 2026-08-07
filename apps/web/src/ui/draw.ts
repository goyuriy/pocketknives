import type { Board, FieldOutline, Ring, Throw, ThrowOutcome, Vec2 } from '@pocketknives/core';
import { area, centroid, normalize } from '@pocketknives/core';
import type { Viewport } from './viewport.js';
import { colorOf } from './theme.js';

/** Adds a ring to the current path without starting a new one. */
const traceSubpath = (ctx: CanvasRenderingContext2D, ring: Ring, view: Viewport): void => {
  ring.forEach((point, index) => {
    const [x, y] = view.toScreen(point);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
};

const tracePath = (ctx: CanvasRenderingContext2D, ring: Ring, view: Viewport): void => {
  ctx.beginPath();
  traceSubpath(ctx, ring, view);
};

const drawArena = (ctx: CanvasRenderingContext2D, board: Board, view: Viewport): void => {
  tracePath(ctx, board.arena, view);
  ctx.fillStyle = '#191511';
  ctx.fill();
  ctx.strokeStyle = '#4a4137';
  ctx.lineWidth = 2;
  ctx.stroke();
};

/**
 * Ground is drawn per connected field, not per piece.
 *
 * A piece is a bookkeeping unit, not something a player sees. Both halves of
 * this matter: the pieces of one field go into a *single* path so the fill
 * rasterises as one shape — abutting edges cancel, and no seam appears where a
 * player's own winnings meet — and only the outer frontier is stroked, so the
 * opening wedge lines disappear once the same player holds both sides.
 */
const drawFields = (
  ctx: CanvasRenderingContext2D,
  fields: readonly FieldOutline[],
  view: Viewport,
  alive: readonly string[],
): void => {
  for (const { ownerId, rings } of fields) {
    ctx.beginPath();
    for (const ring of rings) traceSubpath(ctx, ring, view);
    // Dimmed by owner, not by piece: a knocked-out player's ground reads as
    // spent, while a live player's holdings all look equally held.
    ctx.fillStyle = colorOf(ownerId) + (alive.includes(ownerId) ? '55' : '1f');
    ctx.fill();
  }

  ctx.lineWidth = 1.5;
  ctx.lineCap = 'butt';
  for (const { ownerId, segments } of fields) {
    ctx.strokeStyle = colorOf(ownerId);
    ctx.beginPath();
    for (const [a, b] of segments) {
      const from = view.toScreen(a);
      const to = view.toScreen(b);
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
    }
    ctx.stroke();
  }
};

const drawClaimPreview = (
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  view: Viewport,
  color: string,
): void => {
  tracePath(ctx, ring, view);
  ctx.fillStyle = color + 'aa';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawCut = (
  ctx: CanvasRenderingContext2D,
  cut: readonly [Vec2, Vec2],
  view: Viewport,
  color: string,
): void => {
  const [a, b] = cut.map(view.toScreen) as [Vec2, Vec2];
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.stroke();
};

/** The knife: a marker at the landing point with the blade laid along the cut. */
const drawBlade = (
  ctx: CanvasRenderingContext2D,
  attempt: Throw,
  view: Viewport,
  color: string,
): void => {
  const heading = normalize(attempt.direction);
  const [px, py] = view.toScreen(attempt.point);
  const half = 18;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(-heading[1], heading[0]));

  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.lineTo(half, 0);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

/**
 * One name per player, placed on their biggest piece.
 *
 * Ground won on different turns is stored as separate polygons even where it
 * looks like one field, so labelling every polygon would print the same name
 * repeatedly across what a player reads as a single region.
 *
 * Ranked by area rather than by the inscribed-circle measure the rules use:
 * this runs on every frame of an aim drag, and area is a single pass over the
 * vertices where the inscribed circle is a grid sweep.
 */
const drawOwnerLabels = (ctx: CanvasRenderingContext2D, board: Board, view: Viewport): void => {
  ctx.font = '600 11px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const arenaArea = area(board.arena);
  const biggest = new Map<string, { ring: Ring; size: number }>();
  for (const { ownerId, ring } of board.territories) {
    const size = area(ring);
    if (size < (biggest.get(ownerId)?.size ?? 0)) continue;
    biggest.set(ownerId, { ring, size });
  }

  for (const [ownerId, { ring, size }] of biggest) {
    if (size < arenaArea * 0.01) continue;
    const [x, y] = view.toScreen(centroid(ring));
    ctx.fillStyle = '#ffffffcc';
    ctx.fillText(ownerId, x, y);
  }
};

/**
 * Paints one frame: the board as it stands, plus the throw being aimed.
 *
 * The preview is a full rule resolution, so what the player sees highlighted is
 * exactly the ground the commit will hand over — never an approximation of it.
 */
export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  board: Board,
  view: Viewport,
  alive: readonly string[],
  fields: readonly FieldOutline[],
  draft: Throw | null,
  preview: ThrowOutcome | null,
  currentPlayer: string,
): void => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  drawArena(ctx, board, view);
  drawFields(ctx, fields, view, alive);
  drawOwnerLabels(ctx, board, view);

  if (preview?.kind === 'claimed') {
    // Land stranded by the cut is shown alongside the cut piece — it is part of
    // what the throw wins, so it must be visible before committing to it.
    for (const ring of preview.absorbedRings) {
      drawClaimPreview(ctx, ring, view, colorOf(currentPlayer));
    }
    drawClaimPreview(ctx, preview.claimedRing, view, colorOf(currentPlayer));
    drawCut(ctx, preview.cut, view, '#ffffff');
  } else if (preview?.kind === 'miss' && preview.cut) {
    drawCut(ctx, preview.cut, view, '#8d8378');
  }

  if (draft) drawBlade(ctx, draft, view, colorOf(currentPlayer));
};
