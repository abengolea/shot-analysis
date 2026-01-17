"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

type FormattedTextProps = {
  text: string;
  className?: string;
};

type InlineToken = {
  marker: string;
  type: "bold" | "italic" | "underline" | "boldItalic";
};

const INLINE_TOKENS: InlineToken[] = [
  { marker: "***", type: "boldItalic" },
  { marker: "**", type: "bold" },
  { marker: "__", type: "underline" },
  { marker: "_", type: "italic" },
  { marker: "*", type: "italic" },
];

function findNextToken(text: string, fromIndex: number) {
  let bestIndex = -1;
  let bestToken: InlineToken | null = null;

  for (const token of INLINE_TOKENS) {
    const idx = text.indexOf(token.marker, fromIndex);
    if (idx === -1) continue;
    if (bestIndex === -1 || idx < bestIndex) {
      bestIndex = idx;
      bestToken = token;
      continue;
    }
    if (idx === bestIndex && bestToken && token.marker.length > bestToken.marker.length) {
      bestIndex = idx;
      bestToken = token;
    }
  }

  if (bestIndex === -1 || !bestToken) return null;
  return { index: bestIndex, token: bestToken };
}

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let keyIndex = 0;

  while (i < text.length) {
    const next = findNextToken(text, i);
    if (!next) {
      nodes.push(text.slice(i));
      break;
    }

    if (next.index > i) {
      nodes.push(text.slice(i, next.index));
    }

    const { marker, type } = next.token;
    const closeIndex = text.indexOf(marker, next.index + marker.length);
    if (closeIndex === -1) {
      nodes.push(text.slice(next.index));
      break;
    }

    const inner = text.slice(next.index + marker.length, closeIndex);
    const children = parseInline(inner, `${keyPrefix}-${keyIndex}`);

    if (type === "boldItalic") {
      nodes.push(
        <strong key={`${keyPrefix}-bi-${keyIndex++}`}>
          <em>{children}</em>
        </strong>
      );
    } else if (type === "bold") {
      nodes.push(
        <strong key={`${keyPrefix}-b-${keyIndex++}`}>{children}</strong>
      );
    } else if (type === "underline") {
      nodes.push(
        <span key={`${keyPrefix}-u-${keyIndex++}`} className="underline">
          {children}
        </span>
      );
    } else {
      nodes.push(
        <em key={`${keyPrefix}-i-${keyIndex++}`}>{children}</em>
      );
    }

    i = closeIndex + marker.length;
  }

  return nodes;
}

function buildBlocks(text: string): ReactNode[] {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: ReactNode[][] = [];

  const flushList = (keySuffix: string) => {
    if (!listType || listItems.length === 0) return;
    if (listType === "ul") {
      blocks.push(
        <ul key={`ul-${keySuffix}`} className="list-disc list-inside space-y-1">
          {listItems.map((content, idx) => (
            <li key={`ul-item-${keySuffix}-${idx}`}>{content}</li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={`ol-${keySuffix}`} className="list-decimal list-inside space-y-1">
          {listItems.map((content, idx) => (
            <li key={`ol-item-${keySuffix}-${idx}`}>{content}</li>
          ))}
        </ol>
      );
    }
    listType = null;
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const unordered = line.match(/^\s*[-•]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);

    if (unordered) {
      if (listType && listType !== "ul") flushList(`switch-${idx}`);
      listType = "ul";
      listItems.push(parseInline(unordered[1], `ul-${idx}`));
      return;
    }

    if (ordered) {
      if (listType && listType !== "ol") flushList(`switch-${idx}`);
      listType = "ol";
      listItems.push(parseInline(ordered[1], `ol-${idx}`));
      return;
    }

    if (line.trim() === "") {
      flushList(`blank-${idx}`);
      blocks.push(<div key={`spacer-${idx}`} className="h-2" />);
      return;
    }

    flushList(`p-${idx}`);
    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {parseInline(line, `p-${idx}`)}
      </p>
    );
  });

  flushList("end");
  return blocks;
}

export function FormattedText({ text, className }: FormattedTextProps) {
  const blocks = useMemo(() => buildBlocks(text), [text]);
  const mergedClassName = ["space-y-2", className].filter(Boolean).join(" ");

  return <div className={mergedClassName}>{blocks}</div>;
}
