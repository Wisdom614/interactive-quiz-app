'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string | null | undefined;
  className?: string;
  block?: boolean;
}

/**
 * MathText parses and renders text containing standard strings and LaTeX math formulas.
 * Supports:
 * - Block math: $$ ... $$ or \[ ... \]
 * - Inline math: $ ... $ or \( ... \)
 * - Direct LaTeX commands or formulas (\frac, \sqrt, \int, \pi, \alpha, etc.)
 * - Standard formulas & Unicode mathematical symbols
 */
export function MathText({ text, className = '', block = false }: MathTextProps) {
  const content = text || '';

  const parsedSegments = useMemo(() => {
    if (!content) return [];

    // Regex to split by $$...$$ (block) or $...$ (inline) or \(...\) or \[...\]
    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([\s\S]*?\\\))/g;
    const parts = content.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Check if it's block math
      if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
        const math = part.startsWith('$$')
          ? part.slice(2, -2).trim()
          : part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="katex-block my-1.5 block overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      }

      // Check if it's inline math
      if ((part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
        const math = part.startsWith('$')
          ? part.slice(1, -1).trim()
          : part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="katex-inline inline-block align-middle px-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      }

      // Fallback check: if part contains raw unescaped TeX commands like \frac, \sqrt, \int, \pi, \sum, \lim, \times
      if (/\\(frac|sqrt|int|sum|prod|lim|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|Delta|Sigma|Omega|infty|approx|neq|le|ge|pm|times|div|vec|hat|partial|nabla)\b/i.test(part)) {
        try {
          const html = katex.renderToString(part, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="katex-inline inline-block align-middle px-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      }

      // Regular text segment
      return <span key={index}>{part}</span>;
    });
  }, [content]);

  return (
    <span className={`math-text-container ${className}`}>
      {parsedSegments}
    </span>
  );
}
