import React from 'react';

export interface NodePosition {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  type: 'start' | 'transition' | 'hub' | 'branch' | 'end';
  labelPosition?: 'top' | 'bottom';
}

export interface Connection {
  from: string;
  to: string;
  dashed?: boolean;
}