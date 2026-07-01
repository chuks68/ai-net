import React, { useState } from 'react';
import { DesignResult, ComponentNode } from '../../types/agent';
import { getDesignDetails } from '../../utils/agentUtils';

interface Props {
  result: DesignResult | null | undefined;
}

// Collapsible Tree Node Component
const TreeNode: React.FC<{ node: ComponentNode; depth: number }> = ({ node, depth }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const toggle = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="tree-node-wrapper" style={{ margin: '4px 0' }}>
      <div
        className="tree-node-header"
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          borderRadius: '6px',
          cursor: hasChildren ? 'pointer' : 'default',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          transition: 'background-color 0.2s ease',
          fontSize: '0.9rem',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (hasChildren) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          if (hasChildren) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
        }}
      >
        {hasChildren ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>
            ▶
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.15)' }}>●</span>
        )}
        <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontFamily: 'monospace', fontSize: '0.8rem' }}>&lt;</span>
        <span style={{ fontWeight: 600, color: hasChildren ? '#38bdf8' : '#e2e8f0' }}>{node.name}</span>
        <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontFamily: 'monospace', fontSize: '0.8rem' }}>/&gt;</span>
      </div>

      {hasChildren && isOpen && (
        <div
          className="tree-node-children"
          style={{
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            marginLeft: '18px',
            paddingLeft: '12px',
          }}
        >
          {node.children!.map((child, idx) => (
            <TreeNode key={`${child.name}-${idx}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const DesignRenderer: React.FC<Props> = ({ result }) => {
  const details = getDesignDetails(result);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  if (!details || (details.colors.length === 0 && !details.hierarchy)) {
    return (
      <div
        className="empty-state"
        id="empty-design"
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}
      >
        No design output available.
      </div>
    );
  }

  const handleCopyColor = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedColor(hex);
      setTimeout(() => setCopiedColor(null), 1500);
    } catch (err) {
      console.error('Failed to copy hex', err);
    }
  };

  return (
    <div className="design-renderer" id="design-output">
      {/* Color Palette Swatches */}
      {details.colors.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ marginBottom: '14px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Color Palette Swatches</h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '12px',
            }}
          >
            {details.colors.map((color, idx) => {
              const hexVal = color.hex || color.value || '#000000';
              const nameVal = color.name || hexVal;
              const isCopied = copiedColor === hexVal;

              return (
                <div
                  key={`color-${idx}`}
                  onClick={() => handleCopyColor(hexVal)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  <div
                    style={{
                      height: '50px',
                      backgroundColor: hexVal,
                      borderRadius: '6px',
                      marginBottom: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#fff' }}>
                    {nameVal}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isCopied ? '#10b981' : 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                    {isCopied ? 'Copied!' : hexVal}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible Component Hierarchy Tree */}
      {details.hierarchy && (
        <div>
          <h4 style={{ marginBottom: '14px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Component Hierarchy Tree</h4>
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              overflowX: 'auto',
            }}
          >
            <TreeNode node={details.hierarchy} depth={0} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignRenderer;
