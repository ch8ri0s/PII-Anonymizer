import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind conflict resolution.
 *
 * Combines clsx for conditional classes with tailwind-merge for intelligent
 * Tailwind class deduplication and conflict resolution.
 *
 * @param inputs - Class names, arrays, or conditional objects
 * @returns Merged class string with conflicts resolved
 *
 * @example
 * // Basic usage
 * cn('px-4 py-2', 'bg-blue-500')
 * // => 'px-4 py-2 bg-blue-500'
 *
 * @example
 * // Conditional classes
 * cn('base-class', isActive && 'active-class', className)
 *
 * @example
 * // Tailwind conflict resolution (last wins)
 * cn('text-red-500', 'text-blue-500')
 * // => 'text-blue-500'
 *
 * @example
 * // Different axes are preserved
 * cn('p-4', 'px-6')
 * // => 'p-4 px-6'
 *
 * @example
 * // With arrays and objects
 * cn(['base'], { active: true, disabled: false })
 * // => 'base active'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
