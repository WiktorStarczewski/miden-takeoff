import { useCallback, useRef } from "react";
import { usePlaygroundStore } from "@/store/usePlaygroundStore";
import { compileContract } from "@/services/compileService";
import { streamChat } from "@/services/chatService";
import { extractCodeBlocks } from "@/lib/codeParser";
import { getContractSystemPrompt } from "@/lib/systemPrompts";
import { parseCargoOutput } from "@/components/editor/diagnostics";
import type * as monaco from "monaco-editor";

// Store a reference to the Monaco instance for setting markers
let monacoInstance: typeof monaco | null = null;
export function setMonacoInstance(m: typeof monaco) {
  monacoInstance = m;
}

export function useCompile() {
  const contractFiles = usePlaygroundStore((s) => s.contractFiles);
  const setCompileStatus = usePlaygroundStore((s) => s.setCompileStatus);
  const setPackageBytes = usePlaygroundStore((s) => s.setPackageBytes);
  const setContractError = usePlaygroundStore((s) => s.setContractError);
  const addContract = usePlaygroundStore((s) => s.addContract);
  const appendConsole = usePlaygroundStore((s) => s.appendConsole);
  const autoFixInProgress = useRef(false);

  // Auto-fix: send compile error to AI, apply the fix, recompile
  const autoFixFromError = useCallback(
    (errorOutput: string) => {
      // Get current contract source
      const state = usePlaygroundStore.getState();
      const libRs = state.contractFiles.get("/src/lib.rs")?.content ?? "";
      const cargoToml = state.contractFiles.get("/Cargo.toml")?.content ?? "";

      // Build a message for the AI with the error and current code
      const fixPrompt = `The contract failed to compile with the following error:\n\n\`\`\`\n${errorOutput.slice(-1500)}\n\`\`\`\n\nCurrent lib.rs:\n\`\`\`rust\n${libRs}\n\`\`\`\n\nCurrent Cargo.toml:\n\`\`\`toml\n${cargoToml}\n\`\`\`\n\nFix the error and output the corrected code.`;

      // Add messages to the contract chat
      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      usePlaygroundStore.setState((s) => ({
        contractChat: [
          ...s.contractChat,
          { id: userMsgId, role: "user" as const, content: fixPrompt },
          {
            id: assistantMsgId,
            role: "assistant" as const,
            content: "",
            isStreaming: true,
          },
        ],
        streamingMessageId: assistantMsgId,
      }));

      // Stream the fix from Claude
      let fullContent = "";
      const systemPrompt = getContractSystemPrompt();
      const messages = [
        ...state.contractChat.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: fixPrompt },
      ];

      streamChat(state.mode, messages, systemPrompt, {
        onChunk: (text) => {
          fullContent += text;
          usePlaygroundStore.setState((s) => ({
            contractChat: s.contractChat.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: fullContent }
                : msg,
            ),
          }));
        },
        onDone: () => {
          const codeBlocks = extractCodeBlocks(fullContent);
          usePlaygroundStore.setState((s) => ({
            contractChat: s.contractChat.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: fullContent,
                    isStreaming: false,
                    codeBlocks,
                  }
                : msg,
            ),
            streamingMessageId: null,
          }));

          // Auto-apply the code blocks
          for (const block of codeBlocks) {
            if (block.suggestedPath) {
              const lang =
                block.language === "rust" || block.language === "rs"
                  ? "rust"
                  : block.language === "toml"
                    ? "toml"
                    : ("typescript" as const);

              const files = usePlaygroundStore.getState().contractFiles;
              if (files.has(block.suggestedPath)) {
                usePlaygroundStore
                  .getState()
                  .updateFile(block.suggestedPath, block.code);
              } else {
                usePlaygroundStore
                  .getState()
                  .createFile(block.suggestedPath, block.code, lang);
              }
              appendConsole(
                "info",
                `Auto-applied fix to ${block.suggestedPath}`,
              );
            }
          }

          autoFixInProgress.current = false;
          appendConsole("system", "Fix applied. Click Compile to retry.");
        },
        onError: (error) => {
          appendConsole("error", `Auto-fix failed: ${error}`);
          usePlaygroundStore.setState((s) => ({
            contractChat: s.contractChat.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: fullContent + `\n\n*Error: ${error}*`,
                    isStreaming: false,
                  }
                : msg,
            ),
            streamingMessageId: null,
          }));
          autoFixInProgress.current = false;
        },
      });
    },
    [appendConsole],
  );

  const compile = useCallback(
    async (contractName: string) => {
      addContract(contractName);
      setCompileStatus(contractName, "compiling");
      appendConsole("system", `Compiling ${contractName}...`);

      // Build files map from virtual FS
      const files: Record<string, string> = {};
      for (const [path, file] of contractFiles) {
        files[path.replace(/^\//, "")] = file.content;
      }

      // Extract metadata from Cargo.toml and lib.rs for use in dApp TX scripts
      const cargoToml = files["Cargo.toml"] ?? "";
      const libRs = files["src/lib.rs"] ?? "";

      // Parse component package from Cargo.toml: package = "miden:counter-contract"
      const pkgMatch = cargoToml.match(
        /\[package\.metadata\.component\][\s\S]*?package\s*=\s*"([^"]+)"/,
      );
      const componentPackage = pkgMatch?.[1] ?? "";

      // Parse public method names from lib.rs: pub fn method_name
      const methods = [...libRs.matchAll(/pub\s+fn\s+(\w+)/g)].map((m) => m[1]);

      // Store metadata on the contract entry
      if (componentPackage || methods.length > 0) {
        usePlaygroundStore.getState().contracts.get(contractName);
        usePlaygroundStore.setState((state) => {
          const contracts = new Map(state.contracts);
          const entry = contracts.get(contractName);
          if (entry) {
            contracts.set(contractName, {
              ...entry,
              componentPackage,
              methods,
            });
          }
          return { contracts };
        });
      }

      await compileContract(files, {
        onOutput: (text) => {
          appendConsole("info", text);

          // Apply inline diagnostics to Monaco
          if (monacoInstance) {
            const markers = parseCargoOutput(text);
            const models = monacoInstance.editor.getModels();
            for (const model of models) {
              if (model.uri.path.endsWith(".rs")) {
                monacoInstance.editor.setModelMarkers(
                  model,
                  "cargo-miden",
                  markers,
                );
              }
            }
          }
        },
        onResult: (result) => {
          if (result.success) {
            setCompileStatus(contractName, "success", result.output);
            appendConsole("success", `Build succeeded: ${contractName}`);

            if (result.packageBase64) {
              const bytes = Uint8Array.from(atob(result.packageBase64), (c) =>
                c.charCodeAt(0),
              );
              setPackageBytes(contractName, bytes);
            }

            // Store tx scripts if available
            if (result.txScripts) {
              const txScriptBytes: Record<string, Uint8Array> = {};
              for (const [method, base64] of Object.entries(result.txScripts)) {
                txScriptBytes[method] = Uint8Array.from(atob(base64), (c) =>
                  c.charCodeAt(0),
                );
              }
              usePlaygroundStore.setState((state) => {
                const contracts = new Map(state.contracts);
                const entry = contracts.get(contractName);
                if (entry) {
                  contracts.set(contractName, {
                    ...entry,
                    txScripts: txScriptBytes,
                  });
                }
                return { contracts };
              });
            }

            // Clear diagnostics on success
            if (monacoInstance) {
              for (const model of monacoInstance.editor.getModels()) {
                monacoInstance.editor.setModelMarkers(model, "cargo-miden", []);
              }
            }
          } else {
            setCompileStatus(contractName, "error", result.output);
            setContractError(contractName, result.output);
            appendConsole("error", `Build failed: ${contractName}`);

            // Auto-fix: send error to AI assistant to fix the contract
            if (!autoFixInProgress.current) {
              autoFixInProgress.current = true;
              appendConsole("system", "Asking AI to fix the error...");
              autoFixFromError(result.output);
            }
          }
        },
        onError: (error) => {
          setCompileStatus(contractName, "error");
          setContractError(contractName, error);
          appendConsole("error", error);
        },
      });
    },
    [
      contractFiles,
      setCompileStatus,
      setPackageBytes,
      setContractError,
      addContract,
      appendConsole,
    ],
  );

  return { compile };
}
