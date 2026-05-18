import { TopBar } from "@/components/layout/TopBar";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { StatusBar } from "@/components/layout/StatusBar";
import { usePersistence } from "@/hooks/usePersistence";
import { useInitialFiles } from "@/hooks/useInitialFiles";
import { MidenFiSignerProvider } from "@miden-sdk/miden-wallet-adapter-react";
import { WalletAdapterNetwork } from "@miden-sdk/miden-wallet-adapter-base";
import { MidenProvider } from "@miden-sdk/react";
import { Rocket } from "lucide-react";

const MIDEN_CONFIG = {
  rpcUrl: "testnet" as const,
  prover: "testnet" as const,
  autoSyncInterval: 15000,
};

export default function App() {
  const { isHydrated } = usePersistence();

  if (!isHydrated) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4">
        <Rocket className="h-8 w-8 text-primary animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <MidenFiSignerProvider
      network={WalletAdapterNetwork.Testnet}
      appName="Miden Takeoff"
      // autoConnect={true}
      storageMode="public"
    >
      <MidenProvider
        config={MIDEN_CONFIG}
        loadingComponent={
          <div className="h-screen w-screen flex flex-col items-center justify-center gap-4">
            <Rocket className="h-8 w-8 text-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              Initializing Miden...
            </span>
          </div>
        }
        errorComponent={(error) => (
          <div className="h-screen w-screen flex flex-col items-center justify-center gap-4">
            <span className="text-sm text-red-400">
              Failed to initialize:{" "}
              {error instanceof Error ? error.message : String(error)}
            </span>
          </div>
        )}
      >
        <AppContent />
      </MidenProvider>
    </MidenFiSignerProvider>
  );
}

function AppContent() {
  useInitialFiles();

  return (
    <>
      <TopBar />
      <PanelLayout />
      <StatusBar />
    </>
  );
}
