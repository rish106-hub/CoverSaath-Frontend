import { HelpHead } from "@/components/help/HelpHead";
import { SettingsView } from "@/components/help/SettingsView";
import { OfficialLogo } from "@/components/logos";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <>
      <HelpHead route="/settings" />
      <SettingsView logos={{ digilocker: <OfficialLogo id="digilocker" size={40} />, abha: <OfficialLogo id="abha" size={40} /> }} />
    </>
  );
}
