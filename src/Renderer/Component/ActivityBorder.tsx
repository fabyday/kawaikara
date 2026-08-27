import { useLayoutEffect, useRef, useState } from 'react';

/** Defines the shared activity border inset constant. */
const ACTIVITY_BORDER_INSET = 3;
/** Defines the shared activity border stroke width constant. */
const ACTIVITY_BORDER_STROKE_WIDTH = 2;

/** Describes the activity border geometry contract. */
interface ActivityBorderGeometry {
  /** The width value. */
  readonly width: number;
  /** The height value. */
  readonly height: number;
  /** The radius value. */
  readonly radius: number;
}

/** Describes the activity border props contract. */
export interface ActivityBorderProps {
  /** The class name value. */
  readonly className?: string;
  /** Whether the running option is enabled. */
  readonly running: boolean;
}

/** A short SVG stroke that follows the measured outline of its parent. */
export function ActivityBorder({ className, running }: ActivityBorderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geometry, setGeometry] = useState<ActivityBorderGeometry>({
    width: 52,
    height: 52,
    radius: 15,
  });

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const parent = svg?.parentElement;
    if (!svg || !parent) return;

    /** Updates the geometry. */
    const updateGeometry = () => {
      const bounds = svg.getBoundingClientRect();
      const parsedRadius = Number.parseFloat(
        window.getComputedStyle(parent).borderTopLeftRadius,
      );
      const width = Math.max(0, bounds.width);
      const height = Math.max(0, bounds.height);
      const radius = Math.min(
        Math.max(
          0,
          (Number.isFinite(parsedRadius) ? parsedRadius : 0) +
            ACTIVITY_BORDER_INSET,
        ),
        Math.min(width, height) / 2,
      );

      setGeometry((current) => {
        if (
          current.width === width &&
          current.height === height &&
          current.radius === radius
        ) {
          return current;
        }
        return { width, height, radius
        };
      });
    };

    updateGeometry();
    const observer = new ResizeObserver(updateGeometry);
    observer.observe(svg);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const halfStroke = ACTIVITY_BORDER_STROKE_WIDTH / 2;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={`activity-border${running ? ' is-running' : ''}${
        className ? ` ${className}` : ''
      }`}
      focusable="false"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    >
      <rect
        className="activity-border-stroke"
        fill="none"
        height={Math.max(0, geometry.height - ACTIVITY_BORDER_STROKE_WIDTH)}
        pathLength="100"
        rx={Math.max(0, geometry.radius - halfStroke)}
        ry={Math.max(0, geometry.radius - halfStroke)}
        vectorEffect="non-scaling-stroke"
        width={Math.max(0, geometry.width - ACTIVITY_BORDER_STROKE_WIDTH)}
        x={halfStroke}
        y={halfStroke}
      />
    </svg>
  );
}
