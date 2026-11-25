import { WelcomeIntro } from "@/components/access/Welcome";
import styles from "./welcome.module.css";

export const metadata = { title: "Welcome" };

export default function Welcome() {
  return (
    <main className={styles.page}>
      <WelcomeIntro />
    </main>
  );
}
