import express from "express";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} from "discord.js";
import { config } from "./config.js";
import { COMMAND_NAMES, COMPONENT_IDS } from "./constants/discord.js";
import { createLinkToken, verifyLinkToken } from "./features/stamps/token.js";
import { createStampStore } from "./features/stamps/store.js";
import { getCurrentMonthKey, getTodayInJapan } from "./lib/time.js";

const stampStore = await createStampStore(config.mysql);
const app = express();
const client = config.discordBotDisabled
  ? null
  : new Client({ intents: [GatewayIntentBits.Guilds] });

app.use(express.json());
app.use(express.static("public"));

function buildAppUrl(userId) {
  const token = createLinkToken({
    userId,
    secret: config.linkTokenSecret,
  });

  return `${config.appBaseUrl}/app?token=${encodeURIComponent(token)}`;
}

function resolveSession(request) {
  const token =
    request.query.token ||
    request.headers.authorization?.replace(/^Bearer /, "") ||
    request.body?.token;

  const payload = verifyLinkToken(token, config.linkTokenSecret);
  return { userId: payload.userId, token };
}

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/app", (_request, response) => {
  response.sendFile(new URL("../public/index.html", import.meta.url).pathname);
});

app.get("/api/session", async (request, response) => {
  try {
    const session = resolveSession(request);
    const monthKey = typeof request.query.month === "string" ? request.query.month : getCurrentMonthKey();
    const monthData = await stampStore.getMonthData(session.userId, monthKey);

    response.json({
      userId: session.userId,
      today: getTodayInJapan(),
      token: session.token,
      ...monthData,
    });
  } catch (error) {
    const status = error.message?.includes("token") || error.message?.includes("Invalid")
      ? 401
      : 500;
    const message = status === 401
      ? "リンクの有効期限が切れているか、無効です。"
      : "データの取得に失敗しました。";

    response.status(status).json({ message });
  }
});

app.post("/api/stamps/toggle", async (request, response) => {
  try {
    const session = resolveSession(request);
    const { habitId, stampDate } = request.body;

    if (!Number.isInteger(habitId) || !/^\d{4}-\d{2}-\d{2}$/.test(stampDate)) {
      response.status(400).json({ message: "不正な入力です。" });
      return;
    }

    const result = await stampStore.toggleStamp({
      userId: session.userId,
      habitId,
      stampDate,
    });

    response.json(result);
  } catch (error) {
    const status =
      error.message === "Habit not found"
        ? 404
        : error.message?.includes("token") || error.message?.includes("Invalid")
          ? 401
          : 500;
    response.status(status).json({ message: "スタンプの更新に失敗しました。" });
  }
});

if (client) {
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId === COMPONENT_IDS.openMyPage) {
        const button = new ButtonBuilder()
          .setLabel("自分のスタンプページを開く")
          .setStyle(ButtonStyle.Link)
          .setURL(buildAppUrl(interaction.user.id));

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({
          content: "このリンクはあなた専用です。開くと自分のページだけ見られます。",
          components: [row],
          ephemeral: true,
        });
        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      if (interaction.commandName === COMMAND_NAMES.setupPanel) {
        const embed = new EmbedBuilder()
          .setTitle("DailyStamp")
          .setDescription(
            [
              "毎日の習慣を記録するスタンプパネルです。",
              "下のボタンを押すと、あなた専用のページを開くリンクが届きます。",
            ].join("\n"),
          )
          .setColor(0xd86c45);

        const button = new ButtonBuilder()
          .setCustomId(COMPONENT_IDS.openMyPage)
          .setLabel("マイページを受け取る")
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({
          content: "公開パネルを設置しました。",
          ephemeral: true,
        });

        await interaction.channel?.send({
          embeds: [embed],
          components: [row],
        });
      }
    } catch (error) {
      console.error("interaction error", {
        commandName: interaction.isChatInputCommand() ? interaction.commandName : null,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        error,
      });

      const message = "処理に失敗しました。少し待ってからもう一度試してください。";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true });
        return;
      }

      await interaction.reply({ content: message, ephemeral: true });
    }
  });

  await client.login(config.discordToken);
}

app.listen(config.port, () => {
  console.log(`Web app listening on port ${config.port}`);
});
