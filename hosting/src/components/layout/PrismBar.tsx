import React from 'react';
import { prismGradient } from '@/theme/tokens';

interface PrismBarProps {
  height?: number;
  style?: React.CSSProperties;
}

export const PrismBar: React.FC<PrismBarProps> = ({ height = 3, style }) => (
  <div style={{ height, background: prismGradient, ...style }} />
);
