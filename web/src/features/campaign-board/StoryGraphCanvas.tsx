'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import styles from './CampaignBoard.module.css';
import type { BoardGraphEdge, BoardGraphNode } from './types';

type StoryGraphCanvasProps = {
  nodes: BoardGraphNode[];
  edges: BoardGraphEdge[];
  centerNodeId?: string | null;
  zoom?: number;
  backgroundSelectNodeId?: string;
  testId?: string;
  nodeTestIdPrefix?: string;
  interactive?: boolean;
  onHoverNode: (nodeId: string | null) => void;
  onSelectNode: (nodeId: string) => void;
  onCreateLink?: (sourceId: string, targetId: string) => void;
  stagedDragNodeId?: string | null;
  onDropStagedNote?: (stagedNodeId: string, targetNodeId: string) => void;
  onContextMenuNode?: (nodeId: string, clientX: number, clientY: number) => void;
};

type PositionedNode = BoardGraphNode & {
  canvasX: number;
  canvasY: number;
};

type DragLinkState = {
  sourceId: string;
  sceneX: number;
  sceneY: number;
  originClientX: number;
  originClientY: number;
  moved: boolean;
  targetId: string | null;
};

const SCENE_PADDING = 140;
const MIN_SCENE_WIDTH = 720;
const MIN_SCENE_HEIGHT = 520;
const NODE_HOVER_DIAMETER_BOOST = 11;

const toneClassNameMap: Record<BoardGraphNode['tone'], string> = {
  now: styles.nodeNow,
  pattern: styles.nodePattern,
  dormant: styles.nodeThreadDormant,
  active: styles.nodeThreadActive,
  escalated: styles.nodeThreadEscalated,
  resolved: styles.nodeThreadResolved,
};

function createNodeClassName(
  node: BoardGraphNode,
  {
    isLinkSource = false,
    isLinkTarget = false,
    isTrayDropTarget = false,
  }: { isLinkSource?: boolean; isLinkTarget?: boolean; isTrayDropTarget?: boolean } = {},
): string {
  return [
    styles.nodeBase,
    toneClassNameMap[node.tone],
    node.type === 'thread' ? styles.nodeThread : '',
    node.isPlayerAnchor ? styles.nodePlayerAnchor : '',
    node.isCenteredPlayerAnchor ? styles.nodePlayerAnchorCentered : '',
    !node.accessibleInPerspective ? styles.nodePerspectiveHidden : '',
    isLinkSource ? styles.nodeLinkSource : '',
    isLinkTarget ? styles.nodeLinkTarget : '',
    isTrayDropTarget ? styles.nodeTrayDropTarget : '',
    node.emphasized ? styles.nodeEmphasized : '',
    node.dimmed ? styles.nodeDimmed : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function getEdgePresentation(edge: BoardGraphEdge): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
} {
  const applyPerspectiveOpacity = (opacity: number) =>
    edge.accessibleInPerspective ? opacity : Math.min(opacity, 0.25);

  if (edge.connectionClass === 'manual') {
    return {
      stroke: 'rgba(84, 84, 84, 0.9)',
      strokeWidth: 2.2,
      opacity: applyPerspectiveOpacity(edge.dimmed ? 0.18 : edge.emphasized ? 1 : 0.78),
    };
  }

  if (edge.connectionClass === 'derived') {
    const opacity = edge.dimmed ? 0.14 : edge.emphasized ? 0.96 : edge.tier === 'strong' ? 0.74 : 0.58;

    if (edge.tier === 'medium') {
      return {
        stroke: 'rgba(136, 136, 136, 0.85)',
        strokeWidth: 1.85,
        strokeDasharray: '6 5',
        opacity: applyPerspectiveOpacity(opacity),
      };
    }

    return {
      stroke: 'rgba(98, 98, 98, 0.88)',
      strokeWidth: 2,
      opacity: applyPerspectiveOpacity(opacity),
    };
  }

  return {
    stroke: edge.kind === 'contains' ? 'rgba(152, 152, 152, 0.72)' : 'rgba(176, 176, 176, 0.68)',
    strokeWidth: edge.kind === 'contains' ? 1.3 : 1.55,
    opacity: applyPerspectiveOpacity(edge.dimmed ? 0.16 : edge.emphasized ? 0.92 : 0.48),
  };
}

function getBoundaryPoint(
  source: { x: number; y: number; radius: number },
  target: { x: number; y: number },
) {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const distance = Math.max(Math.hypot(deltaX, deltaY), 1);

  return {
    x: source.x + (deltaX / distance) * source.radius,
    y: source.y + (deltaY / distance) * source.radius,
  };
}

function buildEdgePath(source: PositionedNode, target: PositionedNode, edge: BoardGraphEdge): string {
  const sourceRadius = source.size / 2;
  const targetRadius = target.size / 2;
  const sourceCenter = { x: source.canvasX, y: source.canvasY, radius: sourceRadius };
  const targetCenter = { x: target.canvasX, y: target.canvasY, radius: targetRadius };

  if (edge.connectionClass === 'canonical') {
    const start = getBoundaryPoint(sourceCenter, targetCenter);
    const end = getBoundaryPoint(targetCenter, sourceCenter);

    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  const deltaX = target.canvasX - source.canvasX;
  const deltaY = target.canvasY - source.canvasY;
  const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
  const curveOffset = Math.min(56, distance * 0.16);
  const midX = (source.canvasX + target.canvasX) / 2;
  const midY = (source.canvasY + target.canvasY) / 2;
  const controlX = midX - (deltaY / distance) * curveOffset;
  const controlY = midY + (deltaX / distance) * curveOffset;
  const start = getBoundaryPoint(sourceCenter, { x: controlX, y: controlY });
  const end = getBoundaryPoint(targetCenter, { x: controlX, y: controlY });

  return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
}

function buildPreviewEdgePath(source: PositionedNode, target: { x: number; y: number }) {
  const sourceRadius = source.size / 2;
  const start = getBoundaryPoint(
    { x: source.canvasX, y: source.canvasY, radius: sourceRadius },
    target,
  );

  return `M ${start.x} ${start.y} L ${target.x} ${target.y}`;
}

function getNodeMeta(node: BoardGraphNode): string {
  if (node.type === 'now') {
    return 'Current anchor';
  }

  if (node.type === 'pattern') {
    return 'Pattern cluster';
  }

  return node.state ?? 'thread';
}

function getNodeAriaLabel(node: BoardGraphNode): string {
  return `${node.label}, ${getNodeMeta(node)}`;
}

function buildScene(nodes: BoardGraphNode[]): {
  positionedNodes: PositionedNode[];
  sceneWidth: number;
  sceneHeight: number;
} {
  const visibleNodes = nodes.filter((node) => node.visible);

  if (visibleNodes.length === 0) {
    return {
      positionedNodes: [],
      sceneWidth: MIN_SCENE_WIDTH,
      sceneHeight: MIN_SCENE_HEIGHT,
    };
  }

  const minX = Math.min(...visibleNodes.map((node) => node.position.x - node.size / 2));
  const maxX = Math.max(...visibleNodes.map((node) => node.position.x + node.size / 2));
  const minY = Math.min(...visibleNodes.map((node) => node.position.y - node.size / 2));
  const maxY = Math.max(...visibleNodes.map((node) => node.position.y + node.size / 2));

  const sceneWidth = Math.max(MIN_SCENE_WIDTH, Math.ceil(maxX - minX + SCENE_PADDING * 2));
  const sceneHeight = Math.max(MIN_SCENE_HEIGHT, Math.ceil(maxY - minY + SCENE_PADDING * 2));

  return {
    positionedNodes: visibleNodes.map((node) => ({
      ...node,
      canvasX: node.position.x - minX + SCENE_PADDING,
      canvasY: node.position.y - minY + SCENE_PADDING,
    })),
    sceneWidth,
    sceneHeight,
  };
}

export function StoryGraphCanvas({
  nodes,
  edges,
  centerNodeId,
  zoom,
  backgroundSelectNodeId,
  testId = 'board-canvas',
  nodeTestIdPrefix = 'graph-node',
  interactive = true,
  onHoverNode,
  onSelectNode,
  onCreateLink,
  stagedDragNodeId = null,
  onDropStagedNote,
  onContextMenuNode,
}: StoryGraphCanvasProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragLinkRef = useRef<DragLinkState | null>(null);
  const suppressedNativeContextMenuRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [dragLink, setDragLink] = useState<DragLinkState | null>(null);
  const [trayDropTargetId, setTrayDropTargetId] = useState<string | null>(null);

  function setDragLinkState(
    nextDragLink: DragLinkState | null | ((currentDragLink: DragLinkState | null) => DragLinkState | null),
  ) {
    const resolvedDragLink =
      typeof nextDragLink === 'function' ? nextDragLink(dragLinkRef.current) : nextDragLink;

    dragLinkRef.current = resolvedDragLink;
    setDragLink(resolvedDragLink);
  }

  useEffect(() => {
    if (!stagedDragNodeId) {
      setTrayDropTargetId(null);
    }
  }, [stagedDragNodeId]);

  useEffect(() => {
    const viewportElement = viewportRef.current;

    if (!viewportElement) {
      return undefined;
    }

    const updateViewportSize = () => {
      const bounds = viewportElement.getBoundingClientRect();
      setViewportSize({
        width: bounds.width,
        height: bounds.height,
      });
    };

    updateViewportSize();

    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });

    observer.observe(viewportElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  const { positionedNodes, sceneWidth, sceneHeight } = useMemo(() => buildScene(nodes), [nodes]);
  const positionedNodeMap = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );
  const visibleEdges = useMemo(() => edges.filter((edge) => edge.visible), [edges]);

  const fitScale =
    viewportSize.width > 0 && viewportSize.height > 0
      ? Math.min(viewportSize.width / sceneWidth, viewportSize.height / sceneHeight, 1)
      : 1;
  const effectiveZoom = Math.min(Math.max(zoom ?? 1, 0.5), 2);
  const scale = fitScale * effectiveZoom;
  const centeredNode =
    (centerNodeId ? positionedNodeMap.get(centerNodeId) : undefined) ??
    positionedNodeMap.get('now') ??
    positionedNodes[0];
  const sceneLeft = viewportSize.width > 0 ? viewportSize.width / 2 - (centeredNode?.canvasX ?? sceneWidth / 2) * scale : 0;
  const sceneTop =
    viewportSize.height > 0 ? viewportSize.height / 2 - (centeredNode?.canvasY ?? sceneHeight / 2) * scale : 0;
  const dragSourceNode = dragLink ? positionedNodeMap.get(dragLink.sourceId) : null;
  const dragTargetNode =
    dragLink?.targetId && dragLink.targetId !== dragLink.sourceId
      ? positionedNodeMap.get(dragLink.targetId)
      : null;

  function clientToScene(clientX: number, clientY: number) {
    const viewportBounds = viewportRef.current?.getBoundingClientRect();

    if (!viewportBounds || scale === 0) {
      return {
        x: sceneWidth / 2,
        y: sceneHeight / 2,
      };
    }

    return {
      x: (clientX - viewportBounds.left - sceneLeft) / scale,
      y: (clientY - viewportBounds.top - sceneTop) / scale,
    };
  }

  function updateDragPosition(clientX: number, clientY: number) {
    const scenePoint = clientToScene(clientX, clientY);

    setDragLinkState((currentDragLink) => {
      if (!currentDragLink) {
        return null;
      }

      return {
        ...currentDragLink,
        sceneX: scenePoint.x,
        sceneY: scenePoint.y,
        moved:
          currentDragLink.moved ||
          Math.hypot(clientX - currentDragLink.originClientX, clientY - currentDragLink.originClientY) > 8,
      };
    });
  }

  function findNodeIdFromTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return null;
    }

    const nodeElement = target.closest<HTMLElement>('[data-board-node-id]');
    return nodeElement?.dataset.boardNodeId ?? null;
  }

  function openCustomContextMenu(nodeId: string, clientX: number, clientY: number) {
    setDragLinkState(null);
    onContextMenuNode?.(nodeId, clientX, clientY);
  }

  function handleViewportMouseDownCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !onContextMenuNode || event.button !== 2) {
      return;
    }

    const nodeId = findNodeIdFromTarget(event.target);

    if (!nodeId) {
      return;
    }

    suppressedNativeContextMenuRef.current = true;
    event.preventDefault();
    event.stopPropagation();
    openCustomContextMenu(nodeId, event.clientX, event.clientY);
  }

  function handleViewportContextMenuCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !onContextMenuNode) {
      return;
    }

    const nodeId = findNodeIdFromTarget(event.target);

    if (!nodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (suppressedNativeContextMenuRef.current) {
      suppressedNativeContextMenuRef.current = false;
      return;
    }

    openCustomContextMenu(nodeId, event.clientX, event.clientY);
  }

  return (
    <div className={styles.canvasSurface} data-testid={testId}>
      <div
        ref={viewportRef}
        className={styles.staticCanvasViewport}
        data-testid={`${testId}-viewport`}
        onMouseDownCapture={handleViewportMouseDownCapture}
        onContextMenuCapture={handleViewportContextMenuCapture}
        onMouseLeave={() => onHoverNode(null)}
        onPointerMove={(event) => {
          if (!dragLinkRef.current) {
            return;
          }

          updateDragPosition(event.clientX, event.clientY);
        }}
        onPointerUp={() => {
          if (!dragLinkRef.current) {
            return;
          }

          setDragLinkState(null);
        }}
        onPointerCancel={() => {
          if (!dragLinkRef.current) {
            return;
          }

          setDragLinkState(null);
        }}
        onClick={interactive ? () => onSelectNode(backgroundSelectNodeId ?? 'now') : undefined}
      >
        <div
          className={styles.staticCanvasScene}
          style={{
            width: sceneWidth,
            height: sceneHeight,
            left: sceneLeft,
            top: sceneTop,
            transform: `scale(${scale})`,
          }}
        >
          <svg
            className={styles.staticEdgeLayer}
            width={sceneWidth}
            height={sceneHeight}
            viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
            aria-hidden="true"
          >
            {visibleEdges.map((edge) => {
              const source = positionedNodeMap.get(edge.source);
              const target = positionedNodeMap.get(edge.target);

              if (!source || !target) {
                return null;
              }

              const presentation = getEdgePresentation(edge);

              return (
                <path
                  key={edge.id}
                  data-testid={`graph-edge-${edge.id}`}
                  d={buildEdgePath(source, target, edge)}
                  fill="none"
                  stroke={presentation.stroke}
                  strokeWidth={presentation.strokeWidth}
                  strokeDasharray={presentation.strokeDasharray}
                  opacity={presentation.opacity}
                  strokeLinecap="round"
                />
              );
            })}
            {dragLink && dragSourceNode ? (
              <path
                data-testid="graph-edge-preview"
                d={buildPreviewEdgePath(
                  dragSourceNode,
                  dragTargetNode
                    ? { x: dragTargetNode.canvasX, y: dragTargetNode.canvasY }
                    : { x: dragLink.sceneX, y: dragLink.sceneY },
                )}
                fill="none"
                stroke="rgba(98, 98, 98, 0.92)"
                strokeWidth={2.1}
                strokeDasharray="7 5"
                opacity={0.92}
                strokeLinecap="round"
              />
            ) : null}
          </svg>

          {positionedNodes.map((node) => {
            const nodeStyle = {
              left: node.canvasX,
              top: node.canvasY,
              width: node.size,
              height: node.size,
              '--node-hover-scale': `${(node.size + NODE_HOVER_DIAMETER_BOOST) / node.size}`,
            } as React.CSSProperties;

            if (!interactive) {
              return (
                <div
                  key={node.id}
                  className={styles.graphNodeStatic}
                  style={nodeStyle}
                  data-perspective-hidden={node.accessibleInPerspective ? undefined : 'true'}
                  aria-hidden="true"
                >
                  <span className={createNodeClassName(node)} aria-hidden="true" />
                </div>
              );
            }

            return (
              <button
                key={node.id}
                type="button"
                className={styles.graphNodeButton}
                style={nodeStyle}
                data-testid={`${nodeTestIdPrefix}-${node.id}`}
                data-board-node-id={node.id}
                data-perspective-hidden={node.accessibleInPerspective ? undefined : 'true'}
                aria-label={getNodeAriaLabel(node)}
                title={node.label}
                onMouseEnter={() => onHoverNode(node.id)}
                onPointerEnter={() => {
                  if (!dragLinkRef.current) {
                    return;
                  }

                  setDragLinkState((currentDragLink) =>
                    currentDragLink
                      ? {
                          ...currentDragLink,
                          targetId: node.id === currentDragLink.sourceId ? null : node.id,
                        }
                      : null,
                  );
                }}
                onPointerLeave={() => {
                  if (!dragLinkRef.current || dragLinkRef.current.targetId !== node.id) {
                    return;
                  }

                  setDragLinkState((currentDragLink) =>
                    currentDragLink && currentDragLink.targetId === node.id
                      ? {
                          ...currentDragLink,
                          targetId: null,
                        }
                      : currentDragLink,
                  );
                }}
                onFocus={() => onHoverNode(node.id)}
                onBlur={() => onHoverNode(null)}
                onDragOver={(event) => {
                  if (!stagedDragNodeId) {
                    return;
                  }

                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';

                  if (trayDropTargetId !== node.id) {
                    setTrayDropTargetId(node.id);
                  }
                }}
                onDragLeave={() => {
                  if (trayDropTargetId === node.id) {
                    setTrayDropTargetId(null);
                  }
                }}
                onDrop={(event) => {
                  if (!stagedDragNodeId) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  setTrayDropTargetId(null);
                  onDropStagedNote?.(stagedDragNodeId, node.id);
                }}
                onPointerDown={(event) => {
                  if (!interactive || event.button !== 0) {
                    return;
                  }

                  const scenePoint = clientToScene(event.clientX, event.clientY);

                  setDragLinkState({
                    sourceId: node.id,
                    sceneX: scenePoint.x,
                    sceneY: scenePoint.y,
                    originClientX: event.clientX,
                    originClientY: event.clientY,
                    moved: false,
                    targetId: null,
                  });
                }}
                onPointerUp={(event) => {
                  const currentDragLink = dragLinkRef.current;

                  if (!currentDragLink) {
                    return;
                  }

                  event.stopPropagation();
                  const movedEnough =
                    currentDragLink.moved ||
                    Math.hypot(
                      event.clientX - currentDragLink.originClientX,
                      event.clientY - currentDragLink.originClientY,
                    ) > 8;

                  if (movedEnough && node.id !== currentDragLink.sourceId) {
                    onCreateLink?.(currentDragLink.sourceId, node.id);
                    suppressClickRef.current = true;
                  }

                  setDragLinkState(null);
                }}
                onClick={(event) => {
                  event.stopPropagation();

                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }

                  onSelectNode(node.id);
                }}
              >
                <span
                  className={createNodeClassName(node, {
                    isLinkSource: dragLink?.sourceId === node.id,
                    isLinkTarget: dragLink?.targetId === node.id,
                    isTrayDropTarget: trayDropTargetId === node.id,
                  })}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
