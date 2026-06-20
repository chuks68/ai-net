/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import '@testing-library/jest-dom';
import RiskMatrix from './RiskMatrix';
import { RiskItem } from '../../types/agent';

const fixtureRisks: RiskItem[] = [
  {
    likelihood: 5,
    impact: 5,
    description: 'Critical system failure due to node disconnection',
    mitigations: ['Implement multi-region redundancy', 'Add fallback coordinators'],
    severity: 'critical',
  },
  {
    likelihood: 4,
    impact: 3,
    description: 'High network latency during peak load hours',
    mitigations: ['Implement caching mechanisms', 'Load balance endpoints'],
    severity: 'high',
  },
  {
    likelihood: 3,
    impact: 4,
    description: 'Medium data sync delays',
    mitigations: ['Tune database query parameters', 'Optimize indices'],
    severity: 'medium',
  },
  {
    likelihood: 2,
    impact: 2,
    description: 'Low severity UI glitch',
    mitigations: ['Code linting and browser testing'],
    severity: 'low',
  },
  {
    // A duplicate cell position (e.g. 5, 5) to test that jitter works and both render correctly
    likelihood: 5,
    impact: 5,
    description: 'Duplicate critical risk at 5,5',
    mitigations: ['Duplicate mitigation strategy'],
    severity: 'critical',
  }
];

// Setup grid values same as component
const svgWidth = 500;
const gridPaddingLeft = 60;
const gridPaddingTop = 20;
const gridPaddingRight = 20;
const gridWidth = svgWidth - gridPaddingLeft - gridPaddingRight;
const cellSize = gridWidth / 5; // 84

describe('RiskMatrix Component', () => {
  test('renders all 5 items in their correct cell bounding boxes', () => {
    render(<RiskMatrix result={fixtureRisks} />);

    fixtureRisks.forEach((risk, index) => {
      const dot = screen.getByTestId(`risk-dot-${index}`);
      expect(dot).toBeInTheDocument();

      const cx = parseFloat(dot.getAttribute('cx') || '0');
      const cy = parseFloat(dot.getAttribute('cy') || '0');

      // Correct cell coordinates
      const L = risk.likelihood;
      const I = risk.impact;

      const cellXStart = gridPaddingLeft + (I - 1) * cellSize;
      const cellYStart = gridPaddingTop + (5 - L) * cellSize;
      const cellXEnd = cellXStart + cellSize;
      const cellYEnd = cellYStart + cellSize;

      // Assert coordinate is inside the cell
      expect(cx).toBeGreaterThanOrEqual(cellXStart);
      expect(cx).toBeLessThanOrEqual(cellXEnd);
      expect(cy).toBeGreaterThanOrEqual(cellYStart);
      expect(cy).toBeLessThanOrEqual(cellYEnd);
    });
  });

  test('shows description and mitigations[0] on hover', () => {
    render(<RiskMatrix result={fixtureRisks} />);

    // Tooltip should not be in document initially
    expect(screen.queryByTestId('risk-tooltip')).not.toBeInTheDocument();

    const dot = screen.getByTestId('risk-dot-0');
    
    // Hover over the dot
    fireEvent.mouseEnter(dot);

    const tooltip = screen.getByTestId('risk-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(fixtureRisks[0].description);
    expect(tooltip).toHaveTextContent(fixtureRisks[0].mitigations[0]);

    // Unhover the dot
    fireEvent.mouseLeave(dot);
    expect(screen.queryByTestId('risk-tooltip')).not.toBeInTheDocument();
  });
});
