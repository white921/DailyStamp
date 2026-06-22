import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commandDefinitions } from "./commands/definitions.js";

const rest = new REST({ version: "10" }).setToken(config.discordToken);

await rest.put(
  Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
  { body: commandDefinitions },
);

console.log(`Registered ${commandDefinitions.length} guild commands.`);
