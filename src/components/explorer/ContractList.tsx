import { usePlaygroundStore } from "@/store/usePlaygroundStore";
import { useCompile } from "@/hooks/useCompile";
import { useDeploy } from "@/hooks/useDeploy";
import { uint8ArrayToBase64 } from "@/lib/base64";
import { cn } from "@/lib/cn";
import { Box, Copy, Check, Play, Loader2, Upload, X } from "lucide-react";
import { useState } from "react";
import type { ContractEntry } from "@/store/types";

const statusDots: Record<string, string> = {
  idle: "bg-muted-foreground/30",
  compiling: "bg-yellow-400 animate-pulse",
  success: "bg-primary",
  error: "bg-red-400",
  deploying: "bg-yellow-400 animate-pulse",
  deployed: "bg-primary",
};

export function ContractList() {
  const contracts = usePlaygroundStore((s) => s.contracts);
  const mode = usePlaygroundStore((s) => s.mode);
  const { compile } = useCompile();

  const handleCompile = () => {
    // Use the project name from Cargo.toml or default
    compile("my-contract");
  };

  return (
    <div className="border-t p-3">
      <div className="flex items-center gap-2 mb-3">
        <Box className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Contracts
        </span>
        {mode === "dapp" && (
          <span className="text-[9px] text-muted-foreground/40 ml-auto">
            read-only
          </span>
        )}
      </div>

      {/* Compile button — only in contracts mode */}
      {mode === "contracts" && (
        <button
          onClick={handleCompile}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/15 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/25 transition-colors"
        >
          <Play className="h-3 w-3" />
          Compile
        </button>
      )}

      {contracts.size === 0 ? (
        <div className="text-xs text-muted-foreground/60 italic px-1">
          No contracts
        </div>
      ) : (
        <div className="space-y-1.5">
          {Array.from(contracts.values()).map((c) => (
            <ContractItem
              key={c.name}
              contract={c}
              isReadOnly={mode === "dapp"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContractItem({
  contract,
  isReadOnly,
}: {
  contract: ContractEntry;
  isReadOnly: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { deploy, isReady } = useDeploy();
  const setCompileStatus = usePlaygroundStore((s) => s.setCompileStatus);
  const setDeployStatus = usePlaygroundStore((s) => s.setDeployStatus);

  const handleReset = () => {
    if (contract.compileStatus === "compiling") {
      setCompileStatus(contract.name, "idle");
    }
    if (contract.deployStatus === "deploying") {
      setDeployStatus(contract.name, "idle");
    }
  };

  const isStuck = contract.compileStatus === "compiling" || contract.deployStatus === "deploying";

  const handleCopy = () => {
    if (contract.accountId) {
      navigator.clipboard.writeText(contract.accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeploy = async () => {
    if (!contract.packageBytes) return;
    const base64 = uint8ArrayToBase64(contract.packageBytes);
    await deploy(contract.name, base64);
  };

  const canDeploy =
    !isReadOnly &&
    contract.compileStatus === "success" &&
    contract.deployStatus !== "deploying" &&
    isReady;

  const deployTooltip = !isReady
    ? "Initializing..."
    : contract.compileStatus !== "success"
      ? "Compile first"
      : null;

  const statusLabel =
    contract.deployStatus === "deployed"
      ? "deployed"
      : contract.deployStatus === "deploying"
        ? "deploying..."
        : contract.compileStatus === "success"
          ? "compiled"
          : contract.compileStatus === "compiling"
            ? "compiling..."
            : contract.compileStatus === "error"
              ? "error"
              : "idle";

  return (
    <div className="rounded-lg bg-white/[0.02] p-2 border border-white/[0.04]">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            contract.deployStatus === "deployed"
              ? statusDots.deployed
              : contract.deployStatus === "deploying"
                ? statusDots.deploying
                : statusDots[contract.compileStatus]
          )}
        />
        <span className="text-xs font-medium truncate flex-1">
          {contract.name}
        </span>
        {isStuck && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
            <button
              onClick={handleReset}
              title="Cancel"
              className="text-muted-foreground/50 hover:text-red-400 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
        {statusLabel}
      </span>

      {contract.accountId && (
        <button
          onClick={handleCopy}
          className="mt-1.5 flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors"
        >
          {copied ? (
            <Check className="h-2.5 w-2.5" />
          ) : (
            <Copy className="h-2.5 w-2.5" />
          )}
          {contract.accountId.slice(0, 16)}...
        </button>
      )}

      {!isReadOnly && contract.compileStatus === "success" && (
        <button
          onClick={handleDeploy}
          disabled={!canDeploy}
          title={deployTooltip ?? undefined}
          className={cn(
            "mt-1.5 w-full flex items-center justify-center gap-1 rounded py-1 text-[10px] font-medium transition-colors",
            canDeploy
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "bg-white/[0.03] text-muted-foreground/40 cursor-not-allowed"
          )}
        >
          <Upload className="h-3 w-3" />
          {contract.deployStatus === "deploying"
            ? "Deploying..."
            : contract.deployStatus === "deployed"
              ? "Redeploy"
              : "Deploy"}
        </button>
      )}
    </div>
  );
}
