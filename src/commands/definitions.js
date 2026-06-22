import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { COMMAND_NAMES } from "../constants/discord.js";

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName(COMMAND_NAMES.setupPanel)
    .setDescription("スタンプ用の公開パネルを設置します")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((command) => command.toJSON());
