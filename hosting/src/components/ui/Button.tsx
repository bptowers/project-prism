import { motion } from 'framer-motion';
import React from 'react';

type ButtonVariant = 'primary' | 'ghost';

interface ButtonProps {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--bg-deep)',
    borderColor: 'var(--accent)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border)',
  },
};

export const Button: React.FC<ButtonProps> = ({ variant = 'ghost', icon, children, style, onClick, disabled }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      borderRadius: '5px',
      fontFamily: 'var(--font-body)',
      fontSize: '0.75rem',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: '1px solid var(--border)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      transition: 'all 0.15s ease',
      opacity: disabled ? 0.5 : 1,
      ...variantStyles[variant],
      ...style,
    }}
  >
    {icon}
    {children}
  </motion.button>
);
