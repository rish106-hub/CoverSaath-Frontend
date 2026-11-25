// Route layout for /emergency. Exists so the whole route is static: its root class kills every CSS animation
// and transition (MotionConfig does not stop CSS keyframes), because a person in an emergency must never wait on motion.
import styles from "./emergency.module.css";

export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
