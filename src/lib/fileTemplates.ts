import type { VirtualFile } from "@/store/types";

export const CONTRACT_TEMPLATES: VirtualFile[] = [
  {
    path: "/Cargo.toml",
    language: "toml",
    isDirty: false,
    content: `[package]
name = "my-contract"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib"]

[dependencies]
miden = "0.12.0"

[package.metadata.component]
package = "miden:my-contract"


[package.metadata.miden]
project-kind = "account"
supported-types = ["RegularAccountUpdatableCode", "RegularAccountImmutableCode"]
`,
  },
  {
    path: "/src/lib.rs",
    language: "rust",
    isDirty: false,
    content: `#![no_std]
#![feature(alloc_error_handler)]

use miden::*;

// Chat with the AI assistant to generate your Miden smart contract.
// Use #[component] on struct + impl for account components.
// Click "Compile" when ready, then "Deploy" to publish to testnet.

#[component]
struct MyAccount {
    // Storage
    #[storage(description = "storage value")]
    value: StorageValue<Word>,
}

#[component]
impl MyAccount {
    // Procedures
    pub fn get_value(&self) -> Word {
        self.value.get()
    }
}
`,
  },
];

export const DAPP_TEMPLATES: VirtualFile[] = [
  {
    path: "/src/App.tsx",
    language: "typescriptreact",
    isDirty: false,
    content: `import { useAccounts, useSyncState } from "@miden-sdk/react";

export default function App() {
  const { accounts, isLoading } = useAccounts();
  const { syncHeight } = useSyncState();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div style={{ padding: 24, fontFamily: "Inter, sans-serif" }}>
      <h1>My Miden dApp</h1>
      <p>Block height: {syncHeight}</p>
      <p>Accounts: {accounts?.length ?? 0}</p>
    </div>
  );
}
`,
  },
];

export function getTemplatesForMode(mode: "contracts" | "dapp"): VirtualFile[] {
  return mode === "contracts" ? CONTRACT_TEMPLATES : DAPP_TEMPLATES;
}
