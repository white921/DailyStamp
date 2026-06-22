import "dotenv/config";

const discordBotDisabled = process.env.DISCORD_BOT_DISABLED === "true";
const requiredEnvironmentVariables = [
  "APP_BASE_URL",
  "LINK_TOKEN_SECRET",
  "MYSQL_HOST",
  "MYSQL_USER",
  "MYSQL_DATABASE",
];

if (!discordBotDisabled) {
  requiredEnvironmentVariables.push(
    "DISCORD_TOKEN",
    "DISCORD_CLIENT_ID",
    "DISCORD_GUILD_IDS",
  );
}

const discordGuildIds = (process.env.DISCORD_GUILD_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

for (const key of requiredEnvironmentVariables) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (!discordBotDisabled && discordGuildIds.length === 0) {
  throw new Error("Missing required environment variable: DISCORD_GUILD_IDS");
}

export const config = {
  discordBotDisabled,
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordGuildIds,
  appBaseUrl: process.env.APP_BASE_URL.replace(/\/$/, ""),
  port: Number(process.env.PORT ?? 3000),
  linkTokenSecret: process.env.LINK_TOKEN_SECRET,
  mysql: {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE,
  },
};
