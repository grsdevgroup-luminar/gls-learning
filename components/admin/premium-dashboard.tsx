'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/premium';

/**
 * Premium Admin Dashboard Layout
 * 
 * Inspired by Stripe, Vercel, GitHub
 * - Dense but clean
 * - Tables over cards
 * - Split-pane layout
 * - Command palette ready
 */

interface AdminLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, sidebar }) => {
  return (
    <div className="flex h-screen bg-background">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-card/95 backdrop-blur h-14">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-6 h-6 bg-primary rounded-sm" />
            <span className="text-sm font-semibold">Admin</span>
          </Link>

          {/* Search / Command Palette */}
          <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary border border-border text-sm text-muted-foreground transition-subtle hover:bg-muted ml-auto mr-4 max-w-xs flex-1 justify-between">
            <span className="text-xs">⌘ K</span>
            <span className="text-xs text-muted-foreground">Search…</span>
          </button>

          {/* User Menu */}
          <div className="w-8 h-8 rounded-full bg-primary cursor-pointer" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex pt-14 overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Sidebar (optional) */}
        {sidebar && (
          <aside className="hidden lg:block w-72 border-l border-border bg-card sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-6">
            {sidebar}
          </aside>
        )}
      </main>
    </div>
  );
};

/**
 * Premium Data Table
 * 
 * Clean, minimal table design
 */

interface Column {
  id: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

interface Row {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface DataTableProps {
  columns: Column[];
  rows: Row[];
  onRowClick?: (row: Row) => void;
  selectable?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  rows,
  onRowClick,
  selectable = false,
}) => {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map(r => r.id)));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {selectable && (
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">
                <input
                  type="checkbox"
                  checked={selectedRows.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.id}
                className="px-4 py-3 text-left font-medium text-muted-foreground"
                style={{ width: col.width }}
              >
                <div className="flex items-center gap-2">
                  {col.label}
                  {col.sortable && <span className="text-xs">↕</span>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-border transition-subtle ${
                onRowClick ? 'cursor-pointer hover:bg-secondary/50' : ''
              } ${selectedRows.has(row.id) ? 'bg-primary/5' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {selectable && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4"
                  />
                </td>
              )}
              {columns.map((col) => (
                <td
                  key={`${row.id}-${col.id}`}
                  className="px-4 py-3 text-foreground"
                >
                  {row[col.id] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="px-6 py-12 text-center text-muted-foreground">
          <p className="text-sm">No data to display</p>
        </div>
      )}
    </div>
  );
};

/**
 * Premium Filter Bar
 * 
 * Sticky filter controls for tables
 */

interface FilterBarProps {
  children?: React.ReactNode;
  onSearch?: (query: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ children, onSearch }) => {
  return (
    <div className="sticky top-14 z-30 bg-card border-b border-border px-6 py-4 space-y-4">
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search…"
          onChange={(e) => onSearch?.(e.target.value)}
          className="input-premium flex-1 max-w-xs"
        />
        <Button variant="secondary" size="sm">Filter</Button>
        <Button variant="ghost" size="sm">Export</Button>
      </div>
      {children}
    </div>
  );
};

/**
 * Premium Stat Card (Admin Version)
 * 
 * Dense but elegant metrics
 */

interface AdminStatProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down';
  };
  icon?: React.ReactNode;
}

export const AdminStat: React.FC<AdminStatProps> = ({
  label,
  value,
  change,
  icon,
}) => {
  return (
    <div className="surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-semibold text-foreground mt-2">
            {value}
          </p>
          {change && (
            <p className={`text-xs mt-1 font-medium ${
              change.direction === 'up' ? 'text-success' : 'text-destructive'
            }`}>
              {change.direction === 'up' ? '↑' : '↓'} {Math.abs(change.value)}%
            </p>
          )}
        </div>
        {icon && <div className="text-2xl text-muted-foreground">{icon}</div>}
      </div>
    </div>
  );
};

/**
 * Premium Slide-Over Panel
 * 
 * For editing / details without leaving context
 */

interface SlideOverProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}

export const SlideOver: React.FC<SlideOverProps> = ({
  isOpen,
  title,
  children,
  onClose,
  footer,
}) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-subtle"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-screen w-96 bg-card border-l border-border shadow-xl z-50 flex flex-col transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-subtle text-lg"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-border px-6 py-4 space-y-3">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};

/**
 * Premium Empty State
 * 
 * Friendly, minimal empty state
 */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 text-center">
      {icon && <div className="text-4xl mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Link href={action.href}>
          <Button variant="primary" size="sm">
            {action.label}
          </Button>
        </Link>
      )}
    </div>
  );
};

/**
 * Premium Split Pane
 * 
 * List on left, details on right
 */

interface SplitPaneProps {
  list: React.ReactNode;
  details: React.ReactNode;
}

export const SplitPane: React.FC<SplitPaneProps> = ({ list, details }) => {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* List */}
      <div className="w-96 border-r border-border overflow-y-auto bg-card">
        {list}
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto">
        {details}
      </div>
    </div>
  );
};
