'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string | null | undefined;
  className?: string;
  block?: boolean;
}

const katexCache = new Map<string, string>();

function getCachedKatex(latex: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'B' : 'I'}:${latex}`;
  const cached = katexCache.get(cacheKey);
  if (cached) return cached;

  try {
    const rendered = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
    });
    if (katexCache.size < 500) {
      katexCache.set(cacheKey, rendered);
    }
    return rendered;
  } catch {
    return latex;
  }
}

/**
 * MathText parses and renders text containing standard strings and LaTeX math formulas.
 * Highly optimized with global LRU KaTeX caching.
 */
export const MathText = React.memo(function MathText({ text, className = '', block = false }: MathTextProps) {
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
        const math = part.slice(2, -2).trim();
        const html = getCachedKatex(math, true);
        return (
          <span
            key={index}
            className="katex-block my-1.5 block overflow-x-auto text-center"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // Check if it's inline math
      if ((part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
        const math = part.startsWith('$') ? part.slice(1, -1).trim() : part.slice(2, -2).trim();
        const html = getCachedKatex(math, false);
        return (
          <span
            key={index}
            className="katex-inline inline-block align-middle px-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // Fallback check: if part contains raw unescaped TeX commands
      if (/\\(frac|sqrt|int|sum|prod|lim|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|Delta|Sigma|Omega|infty|approx|neq|le|ge|pm|times|div|vec|hat|partial|nabla)\b/i.test(part)) {
        const html = getCachedKatex(part, false);
        return (
          <span
            key={index}
            className="katex-inline inline-block align-middle px-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
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
});

