import { useCallback } from "react";
import { snakeCase } from "lodash";
import { useMiden, useSyncState } from "@miden-sdk/react";
import { usePlaygroundStore } from "@/store/usePlaygroundStore";

export interface StorageSlotConfig {
  name: string;
}

export function useDeploy() {
  const { client, isReady, runExclusive } = useMiden();
  const { sync } = useSyncState();
  const setDeployStatus = usePlaygroundStore((s) => s.setDeployStatus);
  const setContractError = usePlaygroundStore((s) => s.setContractError);
  const appendConsole = usePlaygroundStore((s) => s.appendConsole);

  const deploy = useCallback(
    async (contractName: string, maspBase64: string) => {
      if (!isReady || !client) {
        throw new Error("Miden client not ready");
      }

      setDeployStatus(contractName, "deploying");
      appendConsole("system", `Deploying ${contractName} to testnet...`);

      try {
        const {
          Package,
          StorageSlotArray,
          AccountComponent,
          AccountBuilder,
          AccountType,
          AccountStorageMode,
        } = await import("@miden-sdk/miden-sdk");

        const result = await runExclusive(async () => {
          // 1. Decode base64 → Uint8Array
          const maspBytes = Uint8Array.from(atob(maspBase64), (c) =>
            c.charCodeAt(0),
          );

          // 2. Deserialize compiled package
          const pkg = Package.deserialize(maspBytes);

          // 3. Construct StorageSlotArray with named slots from the contract
          //    The .masp package expects slots matching the #[storage] fields
          //    Slot name pattern: "miden::component::<package_underscored>::<field>"
          const { StorageSlot, StorageMap: StorageMapClass } =
            await import("@miden-sdk/miden-sdk");

          const slots = new StorageSlotArray();

          // Parse storage fields from the contract's lib.rs
          // Look for #[storage(...)] field_name: StorageMap or Value patterns
          const contractFiles = usePlaygroundStore.getState().contractFiles;
          const libRs = contractFiles.get("/src/lib.rs")?.content ?? "";
          const cargoToml = contractFiles.get("/Cargo.toml")?.content ?? "";

          // Get component package name and convert to slot name prefix
          const pkgMatch = cargoToml.match(
            /\[package\.metadata\.component\][\s\S]*?package\s*=\s*"([^"]+)"/,
          );
          const compPkg = pkgMatch?.[1] ?? ""; // e.g. "miden:counter-contract"
          const structNameMatch = libRs.match(
            /struct\s+([A-Za-z_][A-Za-z0-9_]*)/,
          );
          const structName = structNameMatch?.[1] ?? ""; // e.g. "CounterContract"
          const slotPrefix = `${compPkg.replace(/[:-]/g, "_")}::${snakeCase(structName)}`;

          // Find storage fields
          const storageFields = [
            ...libRs.matchAll(/#\[storage[^\]]*\]\s*(\w+)\s*:\s*(\w+)/g),
          ];

          for (const [, fieldName, fieldType] of storageFields) {
            const slotName = `${slotPrefix}::${fieldName}`;
            // Try both slot types to see which one the contract expects
            try {
              if (fieldType === "StorageMap") {
                slots.push(StorageSlot.map(slotName, new StorageMapClass()));
                appendConsole("info", `  Storage slot (map): ${slotName}`);
              } else {
                slots.push(StorageSlot.emptyValue(slotName));
                appendConsole("info", `  Storage slot (value): ${slotName}`);
              }
            } catch (e) {
              appendConsole(
                "warn",
                `  Failed to create slot ${slotName}: ${e}`,
              );
              // Fallback: try the other type
              try {
                slots.push(StorageSlot.emptyValue(slotName));
                appendConsole(
                  "info",
                  `  Storage slot (fallback value): ${slotName}`,
                );
              } catch {
                appendConsole("error", `  Cannot create slot ${slotName}`);
              }
            }
          }

          // 4. Create component from package with storage slots
          const component = AccountComponent.fromPackage(
            pkg,
            slots,
          ).withSupportsAllTypes();

          // 5. Build account
          const initSeed = crypto.getRandomValues(new Uint8Array(32));
          let builder = new AccountBuilder(initSeed);
          builder = builder.accountType(
            AccountType.RegularAccountUpdatableCode,
          );
          builder = builder.storageMode(AccountStorageMode.public());
          builder = builder.withNoAuthComponent();
          builder = builder.withComponent(component);

          const buildResult = builder.build();
          const account = buildResult.account;
          const seed = buildResult.seed;

          // Debug: inspect the account's storage before saving
          const storage = account.storage();
          const slotNames = storage.getSlotNames();
          appendConsole(
            "info",
            `  Account storage slots after build: [${slotNames.join(", ")}]`,
          );
          for (const name of slotNames) {
            const val = storage.getItem(name);
            appendConsole(
              "info",
              `    ${name} = ${val ? val.toHex() : "null"}`,
            );
          }
          appendConsole(
            "info",
            `  Account code commitment: ${account.code().commitment().toHex()}`,
          );
          appendConsole(
            "info",
            `  Account storage commitment: ${storage.commitment().toHex()}`,
          );

          // 6. Store locally
          await client.newAccount(account, false);

          // Verify: read it back
          const readBack = await client.getAccount(account.id());
          if (readBack) {
            const rbSlots = readBack.storage().getSlotNames();
            appendConsole(
              "info",
              `  Read-back storage slots: [${rbSlots.join(", ")}]`,
            );
          } else {
            appendConsole("warn", `  Could not read back account after saving`);
          }

          const accountId = account.id().toString();
          return { accountId, seed };
        });

        // 7. Sync with network
        await sync();

        setDeployStatus(contractName, "deployed", result.accountId);
        appendConsole(
          "success",
          `Deployed ${contractName}: ${result.accountId}`,
        );

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Deployment failed";
        setDeployStatus(contractName, "error");
        setContractError(contractName, message);
        appendConsole("error", `Deploy failed: ${message}`);
        throw err;
      }
    },
    [
      client,
      isReady,
      sync,
      runExclusive,
      setDeployStatus,
      setContractError,
      appendConsole,
    ],
  );

  return { deploy, isReady };
}
