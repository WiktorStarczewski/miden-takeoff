import { toFile } from "@anthropic-ai/sdk";
// @ts-ignore
import { ZipArchive } from "archiver";
import { join } from "node:path";
import { getClient } from "@/services/claude.js";

export const SKILLS_BETA = "skills-2025-10-02";
const SKILLS_ROOT = join(process.cwd(), "agent-tools", "skills");

export type Skill = { title: string; skillId: string };

/**
 * Specification for a skill to be loaded in a container (request model).
 */
export interface BetaSkillParams {
  /**
   * Skill ID
   */
  skill_id: string;

  /**
   * Type of skill - either 'anthropic' (built-in) or 'custom' (user-defined)
   */
  type: "anthropic" | "custom";

  /**
   * Skill version or 'latest' for most recent version
   */
  version?: string;
}

export const toBetaSkill = (skill: Skill): BetaSkillParams => ({
  type: "custom",
  skill_id: skill.skillId,
  version: "latest",
});

export const CONTRACTS_SKILLS: Skill[] = [
  {
    title: "rust-sdk-patterns",
    skillId: "skill_017s4Qpkue2uChSJvFsZXhA1",
  },
  {
    title: "miden-concepts",
    skillId: "skill_01JVum7mnZ7yRJHs4DT8KPYs",
  },
  {
    title: "rust-sdk-pitfalls",
    skillId: "skill_01YPpC3gVC7FKvQwDcBYh2Nc",
  },
];

export const DAPP_SKILLS: Skill[] = [
  {
    title: "react-sdk-patterns",
    skillId: "skill_01XEBFnte7xo2szPkctNEon5",
  },
  {
    title: "frontend-pitfalls",
    skillId: "skill_01PHRPYuvyuvQ6Phj5bCqne3",
  },
  {
    title: "frontend-source-guide",
    skillId: "skill_01EtTef3XYXfMSW8jnuHpsGZ",
  },
  {
    title: "web-client-usage",
    skillId: "skill_01VePKCWoFWmo7MMNRF96nPo",
  },
];

export async function zipSkill(title: string): Promise<Buffer> {
  const skillDir = join(SKILLS_ROOT, title);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", reject);
  });
  archive.directory(skillDir, title);
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}

export async function createSkillVersion({ title, skillId }: Skill) {
  const zipBuffer = await zipSkill(title);
  const zipFile = await toFile(zipBuffer, `${title}.zip`, {
    type: "application/zip",
  });
  return getClient().beta.skills.versions.create(skillId, {
    files: [zipFile],
    betas: [SKILLS_BETA],
  });
}

/* async function collectSkillFiles(title: string): Promise<File[]> {
  const skillDir = join(SKILLS_ROOT, title);
  const entries = await readdir(skillDir, {
    withFileTypes: true,
    recursive: true,
  });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = join(entry.parentPath, entry.name);
        const content = await readFile(fullPath);
        const relPath = relative(skillDir, fullPath);
        return toFile(content, `${title}/${relPath}`, {
          type: "text/markdown",
        });
      }),
  );
}

export async function createSkill(skill: string) {
  const client = getClient();
  const files = await collectSkillFiles(skill);
  return client.beta.skills.create({
    display_title: skill,
    files,
  });
} */
