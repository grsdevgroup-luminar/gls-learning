'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/premium';

/**
 * Premium Student Portal Layout
 * 
 * Inspired by Notion + Linear
 * - Left navigation (sticky)
 * - Distraction-free main content
 * - Integrated information design
 */

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

interface StudentPortalLayoutProps {
  nav: NavItem[];
  children: React.ReactNode;
  title?: string;
}

export const StudentPortalLayout: React.FC<StudentPortalLayoutProps> = ({
  nav,
  children,
  title,
}) => {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex w-64 border-r border-border flex-col bg-card sticky top-0 left-0 h-screen">
        {/* Logo */}
        <div className="px-6 py-4 border-b border-border">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-sm" />
            <span className="text-sm font-semibold">Academy</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-subtle ${
                item.active
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="px-4 py-4 border-t border-border space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Settings
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border">
          <div className="px-8 py-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold">{title || 'Dashboard'}</h1>
            <div className="flex items-center gap-4">
              <button className="text-muted-foreground hover:text-foreground transition-subtle text-sm">
                Help
              </button>
              <div className="w-8 h-8 rounded-full bg-primary" />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="px-8 py-8 max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
};

/**
 * Premium Progress Card
 * 
 * Minimal, integrated progress display
 */

interface ProgressCardProps {
  title: string;
  progress: number;
  lessons: number;
  duration?: string;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  progress,
  lessons,
  duration,
}) => {
  return (
    <div className="space-y-3 pb-6 border-b border-border">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {lessons} lessons {duration ? `• ${duration}` : ''}
          </p>
        </div>
        <span className="text-sm font-medium text-foreground">{progress}%</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Premium Timeline
 * 
 * Show course progress linearly
 */

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  current?: boolean;
}

interface TimelineProps {
  items: TimelineItem[];
}

export const Timeline: React.FC<TimelineProps> = ({ items }) => {
  return (
    <div className="space-y-0">
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-6 pb-6">
          {/* Timeline Point */}
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full border-2 ${
                item.completed
                  ? 'bg-success border-success'
                  : item.current
                    ? 'bg-primary border-primary'
                    : 'bg-muted border-border'
              }`}
            />
            {index < items.length - 1 && (
              <div className="w-0.5 h-12 bg-border mt-2" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pt-1">
            <h4 className={`text-sm font-medium ${
              item.completed ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}>
              {item.title}
            </h4>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Premium Stat Block
 * 
 * Minimal, integrated metrics
 */

interface StatProps {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: boolean;
}

export const Stat: React.FC<StatProps> = ({ label, value, sublabel, accent }) => {
  return (
    <div className={`p-4 rounded-lg ${
      accent ? 'bg-primary/10 border border-primary/20' : 'bg-secondary border border-border'
    }`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-2xl font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
      )}
    </div>
  );
};

/**
 * Premium Learning Sidebar
 * 
 * Contextual information during course viewing
 */

interface LearningContextProps {
  progress: number;
  currentLesson: number;
  totalLessons: number;
  estimatedTime?: string;
  nextLesson?: string;
}

export const LearningContext: React.FC<LearningContextProps> = ({
  progress,
  currentLesson,
  totalLessons,
  estimatedTime,
  nextLesson,
}) => {
  return (
    <aside className="hidden lg:block w-72 border-l border-border bg-card sticky top-0 h-screen p-6 overflow-y-auto">
      <div className="space-y-8">
        {/* Course Progress */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Course Progress</h3>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentLesson} of {totalLessons} lessons
          </p>
        </div>

        <div className="border-t border-border pt-6 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Estimated Time
          </h4>
          <p className="text-sm text-foreground">{estimatedTime || '2h 30m'}</p>
        </div>

        {nextLesson && (
          <div className="border-t border-border pt-6 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Next Lesson
            </h4>
            <p className="text-sm text-foreground">{nextLesson}</p>
          </div>
        )}

        <div className="border-t border-border pt-6">
          <Button variant="secondary" size="sm" className="w-full">
            Download Materials
          </Button>
        </div>
      </div>
    </aside>
  );
};
