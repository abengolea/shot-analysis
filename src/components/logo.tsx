"use client";

import React from "react";

type LogoSize = "sm" | "md" | "lg" | "xl";

const sizeToClass: Record<LogoSize, string> = {
  sm: "h-7 w-auto",
  md: "h-8 w-auto",
  lg: "h-12 w-auto",
  xl: "h-16 w-auto",
};

export interface LogoProps extends React.HTMLAttributes<HTMLImageElement> {
  size?: LogoSize;
  src?: string;
  alt?: string;
}

export function Logo({ size = "md", src = "/chas-logo.svg", alt = "chaaaas.com logo", className = "", ...rest }: LogoProps) {
  const classNames = `block ${sizeToClass[size]} ${className}`.trim();
  const [srcIndex, setSrcIndex] = React.useState(0);
  const sources = [src, "/chas-logo.png", "/chas-logo.svg", "/favicon.svg"];
  const effectiveSrc = sources[Math.min(srcIndex, sources.length - 1)];

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={classNames}
      onError={() => setSrcIndex((i) => i + 1)}
      {...rest}
    />
  );
}



