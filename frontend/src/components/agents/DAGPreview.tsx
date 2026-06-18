import { useMemo } from 'react';
import { ConnectionLineType, Edge, MarkerType, Node, Position, ReactFlow } from '@reactflow/core';
import { Background } from '@reactflow/background';
import { Controls } from '@reactflow/controls';
import 'reactflow/dist/style.css';
import type { DagEdge, DagNode } from '../../services/taskService';

export type DAGPreviewProps = {
  dagPreview?: {
    nodes: DagNode[];
    edges: DagEdge[];
  };
};

export function DAGPreview({ dagPreview }: DAGPreviewProps) {
  const nodes = dagPreview?.nodes ?? [];
  const edges = dagPreview?.edges ?? [];

  const flowNodes = useMemo<Node[]>(
    () =>
      nodes.map((node, index) => ({
        id: node.id,
        data: { label: node.label },
        position: { x: index * 220, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          padding: 12,
          borderRadius: 12,
          border: '1px solid #d1d5db',
          background: '#ffffff',
          minWidth: 140,
          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
        },
      })),
    [nodes],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge, index) => ({
        id: `edge-${index}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: true,
        style: { stroke: '#4b5563' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#4b5563',
        },
      })),
    [edges],
  );

  if (!nodes.length) {
    return (
      <div
        aria-live="polite"
        style={{
          padding: '24px',
          borderRadius: '12px',
          border: '1px dashed #cbd5e1',
          color: '#475569',
          background: '#f8fafc',
          minHeight: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        No DAG preview available yet.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        connectionLineType={ConnectionLineType.SmoothStep}
        attributionPosition="bottom-left"
      >
        <Controls showInteractive={false} />
        <Background color="#f8fafc" gap={16} />
      </ReactFlow>
    </div>
  );
}
