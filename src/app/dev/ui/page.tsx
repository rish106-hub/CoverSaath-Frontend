"use client";

// Development-only gallery of the shared UI primitives in every tone. Returns 404 in production
// so it can be used to eyeball spacing and motion without shipping a public page.
import { notFound } from "next/navigation";
import { AskCard, BarList, BentoGrid, CountUp, MissingTile, Meter, Reveal, RetryTile, SoonButton, SoonTile, Tile } from "@/components/ui";
import type { TileProps } from "@/components/ui/Tile";

const TONES: NonNullable<TileProps["tone"]>[] = ["plain", "ink", "marker", "signal", "mist", "ochre", "violet", "dark"];

export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <h1>UI primitives</h1>
      <BentoGrid>
        {TONES.map((tone) => (
          <Tile key={tone} tone={tone} label={`Tone ${tone}`} value="5 L" caption="Per year" meter={40} source="Policy page 3" />
        ))}
        <Tile label="Link tile" value="3" caption="Opens a page" href="/dev/ui" />
        <Tile label="Button tile" value="2" caption="Runs an action" onClick={() => undefined} />
        <Tile label="Counting" value={<CountUp to={1200000} format={(n) => `₹${Math.round(n).toLocaleString("en-IN")}`} />} caption="Counts once" />
      </BentoGrid>
      <BentoGrid cols={2}>
        <SoonTile label="Claims" caption="Track claims here" />
        <RetryTile label="Cover" onRetry={() => undefined} />
        <MissingTile label="Room rent" />
        <Reveal><Tile label="Revealed" value="New" caption="Just added" /></Reveal>
      </BentoGrid>
      <BentoGrid split>
        <BarList rows={[{ label: "Room", pct: 80, value: "₹8L" }, { label: "ICU", pct: 45, value: "₹4.5L", tone: "ink" }, { label: "Day care", pct: 20, value: "₹2L", tone: "marker" }, { label: "Ambulance", pct: 10, value: "₹1L", tone: "signal" }]} />
        <AskCard prompts={["What is not covered?", "Can I claim for dental?"]} />
      </BentoGrid>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <SoonButton>Add a policy</SoonButton>
        <SoonButton className="k-btn--primary">Share</SoonButton>
        <div style={{ width: 160 }}><Meter value={65} /></div>
      </div>
    </main>
  );
}
