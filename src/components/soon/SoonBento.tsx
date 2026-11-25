"use client";

// A row of "Coming soon" tiles shown under the live content of a real account's page.
// Exists so a built page never reads as blank: it shows what is live now and what is coming, in the same grid.
import { BentoGrid, SoonTile } from "@/components/ui";

export type SoonBentoTile = { label: string; caption?: string };

export function SoonBento({ tiles }: { tiles: SoonBentoTile[] }) {
  return (
    <BentoGrid cols={3}>
      {tiles.map((tile) => (
        <SoonTile key={tile.label} label={tile.label} caption={tile.caption} />
      ))}
    </BentoGrid>
  );
}
