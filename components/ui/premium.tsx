'use client';

import React from 'react';

/**
 * Premium Button Component
 * 
 * Follows design system:
 * - Subtle hover states
 * - Polished interactions (150ms)
 * - Confident colors with restraint
 */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md',
    isLoading = false,
    className = '',
    children,
    ...props 
  }, ref) => {
    const baseStyles = 'transition-subtle rounded-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantStyles = {
      primary: 'bg-primary text-primary-foreground hover:opacity-90 active:scale-98',
      secondary: 'bg-secondary text-foreground border border-border hover:bg-muted',
      ghost: 'text-foreground hover:bg-secondary hover:border hover:border-border',
      danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? '…' : children}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Premium Input Component
 * 
 * Clean styling with subtle focus state
 */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`input-premium w-full ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

/**
 * Premium Card Component
 * 
 * Minimal elevation with subtle border
 */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'base' | 'elevated';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    elevation = 'base', 
    interactive = false,
    className = '',
    children,
    ...props 
  }, ref) => {
    const elevationStyles = {
      base: 'surface',
      elevated: 'surface-elevated',
    };

    const interactiveStyles = interactive ? 'transition-subtle hover:shadow-md' : '';

    return (
      <div
        ref={ref}
        className={`${elevationStyles[elevation]} ${interactiveStyles} p-6 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Premium Divider
 * 
 * Subtle visual break for sections
 */

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  spacing?: 'sm' | 'md' | 'lg';
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ spacing = 'md', className = '', ...props }, ref) => {
    const spacingStyles = {
      sm: 'my-4',
      md: 'my-6',
      lg: 'my-8',
    };

    return (
      <div
        ref={ref}
        className={`divider ${spacingStyles[spacing]} ${className}`}
        {...props}
      />
    );
  }
);

Divider.displayName = 'Divider';

/**
 * Premium Section Container
 * 
 * Ensures luxurious spacing and hierarchy
 */

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  spacing?: 'sm' | 'md' | 'lg';
}

export const Section = React.forwardRef<HTMLElement, Omit<SectionProps, 'title' | 'subtitle'> & { title?: string | React.ReactNode; subtitle?: string | React.ReactNode }>(
  ({ 
    title, 
    subtitle,
    spacing = 'md',
    className = '',
    children,
    ...props 
  }, ref) => {
    const spacingStyles = {
      sm: 'py-8',
      md: 'py-12',
      lg: 'py-16',
    };

    return (
      <section
        ref={ref as React.Ref<HTMLElement>}
        className={`${spacingStyles[spacing]} border-b border-border last:border-b-0 ${className}`}
        {...props}
      >
        {title && <h2 className="text-2xl font-semibold tracking-tight mb-2">{title}</h2>}
        {subtitle && <p className="text-muted-foreground mb-6">{subtitle}</p>}
        {children}
      </section>
    );
  }
);

Section.displayName = 'Section';

/**
 * Premium Badge
 * 
 * Minimal, understated accent
 */

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ 
    variant = 'default',
    className = '',
    children,
    ...props 
  }, ref) => {
    const variantStyles = {
      default: 'bg-secondary text-foreground',
      success: 'bg-success/10 text-success border border-success/20',
      warning: 'bg-warning/10 text-warning border border-warning/20',
      danger: 'bg-destructive/10 text-destructive border border-destructive/20',
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium transition-subtle ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
