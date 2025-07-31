import React, { useRef, useEffect } from "react";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { TileType } from "../../types/tile";

export type TileComponentProps = {
  tileId: string;
  letter: string;
  size?: number; // Optional size prop in pixels
};

export const Tile: React.FC<TileComponentProps> = ({
  tileId,
  letter,
  size = 48,
}) => {
  const draggableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = draggableRef.current;
    if (element) {
      const data: TileType = { id: tileId, letter };
      const cleanup = draggable({
        element,
        getInitialData: () => data,
        onDragStart: () => {},
      });
      return cleanup;
    }
  }, [tileId, letter]);

  const fontSize = Math.max(12, Math.min(24, size * 0.4)); // Scale font size with tile size

  return (
    <div
      ref={draggableRef}
      className="flex flex-shrink-0 cursor-grab items-center justify-center rounded border-2 border-gray-300 bg-white font-bold text-black shadow-lg transition select-none hover:bg-gray-100"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${fontSize}px`,
      }}
    >
      {letter}
    </div>
  );
};
