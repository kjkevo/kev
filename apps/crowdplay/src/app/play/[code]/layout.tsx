import { SoundToggle } from "@/components/SoundToggle";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed bottom-3 right-3 z-40 opacity-80">
        <SoundToggle />
      </div>
    </>
  );
}
