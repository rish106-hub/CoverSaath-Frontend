import { HelpHead } from "@/components/help/HelpHead";
import { ProfileView } from "@/components/profile/ProfileView";
import { OfficialLogo } from "@/components/logos/server";

export const metadata = { title: "Your profile" };

export default function Page() {
  return (
    <>
      <HelpHead route="/profile" />
      <ProfileView logos={{ digilocker: <OfficialLogo id="digilocker" size={40} />, abha: <OfficialLogo id="abha" size={40} /> }} />
    </>
  );
}
