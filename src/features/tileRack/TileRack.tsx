import { Tile } from "../tile/Tile";
import { useState, useRef, useEffect } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { TileType } from "../../types/tile";
import { useGameStore } from "../../store/gameStore";

const TILE_SIZE = 48; // Fixed tile size in pixels (h-12 w-12 equivalent)
const ROWS_PER_PAGE = 3;
const ARROW_WIDTH = 40; // Width of each arrow button
const HORIZONTAL_PADDING = 32; // px-4 = 16px on each side

export const TileRack: React.FC = () => {
  const yourPlayerId = useGameStore((state) => state.yourPlayerId);
  const peel = useGameStore((state) => state.peel);
  const dump = useGameStore((state) => state.dump);
  const tiles = useGameStore(
    (state) => state.players.find((p) => p.id === yourPlayerId)?.tiles,
  );
  const moveTileToPlayerTiles = useGameStore(
    (state) => state.moveTileToPlayerTiles,
  );
  const letterPool = useGameStore((state) => state.letterPool);
  if (!tiles) throw new Error("Your player not found in game store");

  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [tilesPerRow, setTilesPerRow] = useState(1); // Will be calculated

  const tilesPerPage = tilesPerRow * ROWS_PER_PAGE;

  // Calculate how many tiles fit per row based on fixed tile size
  useEffect(() => {
    // MAYBE make this more compact (square-like) for better UX with scanning the tiles
    const calculateTilesPerRow = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const availableWidth =
        containerWidth - HORIZONTAL_PADDING - 2 * ARROW_WIDTH;

      // Calculate tiles per row: start with 1 tile and add more until they don't fit
      // Each additional tile needs: TILE_SIZE + gap (8px from gap-2)
      // First tile only needs TILE_SIZE (no gap before it)
      let calculatedTilesPerRow = 1;
      let currentWidth = TILE_SIZE;

      while (currentWidth + 8 + TILE_SIZE <= availableWidth) {
        calculatedTilesPerRow++;
        currentWidth += 8 + TILE_SIZE; // gap + tile
      }

      setTilesPerRow(Math.max(1, calculatedTilesPerRow));
    };

    calculateTilesPerRow();

    // Recalculate on window resize
    window.addEventListener("resize", calculateTilesPerRow);
    return () => window.removeEventListener("resize", calculateTilesPerRow);
  }, []);

  const totalPages = Math.ceil(tiles.length / tilesPerPage);
  const startIndex = currentPage * tilesPerPage;
  const endIndex = Math.min(startIndex + tilesPerPage, tiles.length);
  const currentTiles = tiles.slice(startIndex, endIndex);

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  // Create fixed number of rows (always ROWS_PER_PAGE rows)
  const rows = [];
  for (let rowIndex = 0; rowIndex < ROWS_PER_PAGE; rowIndex++) {
    const startTileIndex = rowIndex * tilesPerRow;
    const endTileIndex = startTileIndex + tilesPerRow;
    const rowTiles = currentTiles.slice(startTileIndex, endTileIndex);
    rows.push(rowTiles);
  }

  // Set up droppable area for the tile rack (for moving tiles back to rack)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cleanup = dropTargetForElements({
      element: el,
      onDrop: ({ source }) => {
        const droppedTile = source.data as TileType | undefined;
        if (!droppedTile) return;
        moveTileToPlayerTiles(yourPlayerId, droppedTile);
      },
    });
    return cleanup;
  }, [moveTileToPlayerTiles, yourPlayerId]);

  // Set up droppable area for dumping tiles
  const dumpAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dumpAreaRef.current;
    if (!el) return;
    const cleanup = dropTargetForElements({
      element: el,
      onDrop: ({ source }) => {
        const droppedTile = source.data as TileType | undefined;
        if (!droppedTile) return;
        dump(yourPlayerId, droppedTile);
      },
    });
    return cleanup;
  }, [dump, yourPlayerId]);

  return (
    <div className="w-full bg-yellow-100 px-4 py-3">
      <div className="flex flex-col">
        <div className="flex flex-col md:flex-row">
          {/* Arrows and Tiles */}
          <div
            ref={containerRef}
            className="flex flex-5/6 items-center justify-between"
          >
            {/* Left Arrow or empty space */}
            {currentPage === 0 ? (
              <div className="h-10 w-10" />
            ) : (
              <button
                onClick={goToPreviousPage}
                className="flex h-10 w-10 items-center justify-center rounded-full text-yellow-700 transition hover:bg-yellow-200 active:bg-yellow-300"
                aria-label="Previous page"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Tile Grid - Always shows ROWS_PER_PAGE rows */}
            <div className="flex flex-col gap-2">
              {rows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex justify-center gap-2"
                  style={{ minHeight: `${TILE_SIZE}px` }}
                >
                  {row.map((tile) => (
                    <Tile
                      key={tile.id}
                      tileId={tile.id}
                      letter={tile.letter}
                      size={TILE_SIZE}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Right Arrow or empty space */}
            {currentPage >= totalPages - 1 ? (
              <div className="h-10 w-10" />
            ) : (
              <button
                onClick={goToNextPage}
                className="flex h-10 w-10 items-center justify-center rounded-full text-yellow-700 transition hover:bg-yellow-200 active:bg-yellow-300"
                aria-label="Next page"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
          {/* Peel and Dump area */}
          <div className="mt-2 flex flex-row gap-2 md:flex-col md:items-center md:justify-center">
            <button
              className="rounded bg-green-500 px-3 py-1 font-semibold text-white transition hover:bg-green-600"
              onClick={() => peel(yourPlayerId)}
            >
              Peel
            </button>

            <div
              ref={dumpAreaRef}
              className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-black/30 bg-black/10 p-2 text-center"
            >
              <span>Tiles remaining: {letterPool.length}</span>
              <span>{"(Drag here to dump)"}</span>
            </div>
          </div>
        </div>

        {/* Page Indicator (conditional) */}
        {totalPages > 1 && (
          <div className="my-2 text-center text-sm text-yellow-700">
            Page {currentPage + 1} of {totalPages}
          </div>
        )}
      </div>
    </div>
  );
};
