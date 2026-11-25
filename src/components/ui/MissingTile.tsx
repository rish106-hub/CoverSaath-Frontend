// Tile for a fact the policy does not state. Exists so absence is shown plainly instead of as a blank or zero.
import { Tile } from "./Tile";
import styles from "./tiles.module.css";

export function MissingTile({ label }: { label: string }) {
  return <Tile label={label} value={<span className={styles.muted}>Not in your policy</span>} />;
}
