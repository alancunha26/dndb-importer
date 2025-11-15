/**
 * Config command - Show configuration file location
 */

import { getUserConfigPath } from "../../utils/config";

export function configCommand(): void {
  const configPath = getUserConfigPath();
  console.log("User configuration file location:");
  console.log(configPath);
  console.log("\nCreate this file to customize conversion settings.");
  console.log("See src/config/default.json for available options.");
}
