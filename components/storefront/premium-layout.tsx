'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/premium';

/**
 * Premium Storefront Header
 * 
 * Editorial, minimal, premium
 * - Clean navigation
 * - Subtle interactions
 * - Spacious design
 * - Command palette optional
 */

export const PremiumHeader = () => {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="mx-auto max-w-7xl px-8 py-4">
        {/* Logo + Nav + Actions */}
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 transition-subtle hover:opacity-70">
            <div className="w-8 h-8 bg-primary rounded-sm" />
            <span className="text-lg font-semibold text-foreground">Academy</span>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              href="/courses" 
              className="text-sm text-muted-foreground transition-subtle hover:text-foreground"
            >
              Courses
            </Link>
            <Link 
              href="/about" 
              className="text-sm text-muted-foreground transition-subtle hover:text-foreground"
            >
              About
            </Link>
            <Link 
              href="/contact" 
              className="text-sm text-muted-foreground transition-subtle hover:text-foreground"
            >
              Contact
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary border border-border text-sm text-muted-foreground transition-subtle hover:bg-muted">
              <span>⌘</span>
              <span className="text-xs">K</span>
            </button>
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

/**
 * Premium Course Card
 * 
 * Product-like presentation, not ecommerce
 * - Large imagery
 * - Minimal text
 * - Editorial spacing
 */

interface CourseCardProps {
  id: string;
  title: string;
  category: string;
  image: string;
  price: number;
  instructor: string;
  rating: number;
  students: number;
}

export const PremiumCourseCard: React.FC<CourseCardProps> = ({
  id,
  title,
  category,
  image,
  price,
  instructor,
  rating,
  students,
}) => {
  return (
    <Link href={`/courses/${id}`}>
      <div className="group cursor-pointer transition-subtle hover:opacity-75">
        {/* Image */}
        <div className="relative mb-4 overflow-hidden rounded-lg bg-secondary aspect-video">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-subtle group-hover:scale-102"
          />
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {category}
          </div>
          <h3 className="text-base font-semibold text-foreground leading-tight">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            by {instructor}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-4 pt-2">
            <div className="text-sm text-muted-foreground">
              ★ {rating.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">
              {students.toLocaleString()} students
            </div>
          </div>

          {/* Price */}
          <div className="pt-3 border-t border-border">
            <div className="text-lg font-semibold text-foreground">
              ${price}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

/**
 * Premium Hero Section
 * 
 * Large, editorial, minimal
 * - Big typography
 * - Breathing room
 * - Asymmetrical layout
 */

interface HeroProps {
  heading: string;
  subheading?: string;
  cta?: {
    text: string;
    href: string;
  };
  image?: string;
}

export const PremiumHero: React.FC<HeroProps> = ({
  heading,
  subheading,
  cta,
  image,
}) => {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-8 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="space-y-8">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              {heading}
            </h1>
            
            {subheading && (
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                {subheading}
              </p>
            )}

            {cta && (
              <div className="flex gap-4 pt-4">
                <Link href={cta.href}>
                  <Button variant="primary" size="lg">
                    {cta.text}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Image */}
          {image && (
            <div className="hidden lg:block">
              <Image
                src={image}
                alt={heading}
                width={600}
                height={400}
                className="w-full h-auto rounded-xl"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

/**
 * Premium Features Section
 * 
 * Minimal presentation of key benefits
 */

interface Feature {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

interface FeaturesProps {
  features: Feature[];
}

export const PremiumFeatures: React.FC<FeaturesProps> = ({ features }) => {
  return (
    <section className="editorial-section mx-auto max-w-7xl px-8">
      <div className="space-y-16">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight mb-4">
            Why Academy?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Carefully designed learning experience for ambitious students.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {features.map((feature, i) => (
            <div key={i} className="space-y-4">
              {feature.icon && (
                <div className="text-2xl">{feature.icon}</div>
              )}
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * Premium Footer
 * 
 * Clean, minimal information architecture
 */

export const PremiumFooter = () => {
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="w-8 h-8 bg-primary rounded-sm" />
            <p className="text-sm text-muted-foreground">
              Premium learning for ambitious students.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/courses" className="hover:text-foreground transition-subtle">Courses</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground transition-subtle">Pricing</Link></li>
              <li><Link href="/blog" className="hover:text-foreground transition-subtle">Blog</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Company</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground transition-subtle">About</Link></li>
              <li><Link href="/careers" className="hover:text-foreground transition-subtle">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-foreground transition-subtle">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Legal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/privacy" className="hover:text-foreground transition-subtle">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-foreground transition-subtle">Terms</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-8 flex md:flex-row flex-col justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2024 Academy. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-foreground transition-subtle">Twitter</Link>
            <Link href="#" className="hover:text-foreground transition-subtle">LinkedIn</Link>
            <Link href="#" className="hover:text-foreground transition-subtle">GitHub</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
