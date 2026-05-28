import "dotenv/config";
import {
  CONTRACTS_SKILLS,
  DAPP_SKILLS,
  createSkillVersion,
} from "@/lib/skills.js";

const updateSkills = async () => {
  console.log("Updating skills...");
  for (const skill of [...CONTRACTS_SKILLS, ...DAPP_SKILLS]) {
    console.log(`Updating skill: ${skill.title} (${skill.skillId})`);
    await createSkillVersion(skill);
    console.log(`${skill.title} updated.`);
  }
  console.log("Skills updated.");
};

updateSkills();
