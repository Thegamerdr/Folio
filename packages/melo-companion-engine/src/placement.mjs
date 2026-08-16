const DEFAULT_MARGIN = 12;

export const DEFAULT_COMPANION_SIZE = Object.freeze({ width: 72, height: 96 });

export function rectsIntersect(a, b, margin = 0) {
  return !(
    a.x + a.width + margin <= b.x ||
    b.x + b.width + margin <= a.x ||
    a.y + a.height + margin <= b.y ||
    b.y + b.height + margin <= a.y
  );
}

export function rectInside(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function clampRect(rect, shell, margin = 0) {
  const maxX = Math.max(shell.x + margin, shell.x + shell.width - margin - rect.width);
  const maxY = Math.max(shell.y + margin, shell.y + shell.height - margin - rect.height);
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, shell.x + margin), maxX),
    y: Math.min(Math.max(rect.y, shell.y + margin), maxY),
  };
}

function candidateRect(anchor, shell, size) {
  const resolvedSize = anchor.size ?? size;
  const { x, y, width, height } = anchor.rect;
  const offset = anchor.offset ?? { x: 0, y: 0 };
  const gap = anchor.gap ?? 8;
  const horizontal = anchor.placement.includes('left')
    ? x - resolvedSize.width - gap
    : x + width + gap;
  const vertical = anchor.placement.includes('top')
    ? y - resolvedSize.height - gap
    : y + height + gap;

  let nextX = horizontal;
  let nextY = vertical;
  if (anchor.placement === 'top-right' || anchor.placement === 'bottom-right')
    nextX = x + width - resolvedSize.width;
  if (anchor.placement === 'top-left' || anchor.placement === 'bottom-left') nextX = x;
  if (anchor.placement === 'perch-top') {
    nextX = x + (width - resolvedSize.width) / 2;
    nextY = y - resolvedSize.height - gap;
  }
  if (anchor.placement === 'perch-bottom') {
    nextX = x + (width - resolvedSize.width) / 2;
    nextY = y + height + gap;
  }

  return {
    x: nextX + offset.x,
    y: nextY + offset.y,
    width: resolvedSize.width,
    height: resolvedSize.height,
  };
}

export function resolvePlacement({
  anchors,
  exclusions = [],
  shell,
  size = DEFAULT_COMPANION_SIZE,
  margin = DEFAULT_MARGIN,
  preferredAnchor = null,
  preferredRect = null,
}) {
  const ordered = [...anchors]
    .filter((anchor) => anchor && anchor.rect && !anchor.disabled)
    .sort((a, b) => {
      const preferred = (id) => (id && id === preferredAnchor ? 100000 : 0);
      return preferred(b.id) + (b.priority ?? 0) - (preferred(a.id) + (a.priority ?? 0));
    });
  const rejected = [];

  for (const anchor of ordered) {
    const rect = candidateRect(anchor, shell, size);
    if (!rectInside(rect, shell)) {
      rejected.push({ id: anchor.id, reason: 'outside-shell', rect });
      continue;
    }
    const collision = exclusions.find((zone) => rectsIntersect(rect, zone.rect, margin));
    if (collision) {
      rejected.push({ id: anchor.id, reason: `collision:${collision.id}`, rect });
      continue;
    }
    return { anchorId: anchor.id, rect, rejected };
  }

  if (preferredRect && shell) {
    const rect = clampRect(
      {
        ...preferredRect,
        width: preferredRect.width ?? size.width,
        height: preferredRect.height ?? size.height,
      },
      shell,
      margin,
    );
    const collision = exclusions.find((zone) => rectsIntersect(rect, zone.rect, margin));
    if (!collision) return { anchorId: 'preferred-position', rect, rejected };
    rejected.push({ id: 'preferred-position', reason: `collision:${collision.id}`, rect });
  }

  return { anchorId: null, rect: null, rejected };
}
