```js
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN veya CLIENT_ID eksik!");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readData(name) {
  const file = path.join(DATA_DIR, name);
  try {
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : {};
  } catch {
    return {};
  }
}

function writeData(name, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, name),
    JSON.stringify(data, null, 2)
  );
}

const settings = readData("settings.json");
const tickets = readData("tickets.json");

function config(guildId) {
  if (!settings[guildId]) settings[guildId] = {};
  return settings[guildId];
}

function embed(title, description, color = 0x7C3AED) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function staff(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Ticket seçim panelini gönderir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketkategori")
    .setDescription("Ticket kanallarının açılacağı kategoriyi ayarlar")
    .addChannelOption(option =>
      option
        .setName("kategori")
        .setDescription("Discord ticket kategorisi")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Bot aktif: ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("Slash komutları kaydedildi.");
  } catch (error) {
    console.error("Komut kaydetme hatası:", error);
  }

  client.user.setActivity("Ticket Destek");
});

function ticketPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("🎫 Ticket Kategorisini Seç...")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      {
        label: "Genel Destek",
        description: "Yardım ve sorular",
        value: "general",
        emoji: "💬"
      },
      {
        label: "Şikâyet / Oyuncu",
        description: "Oyuncu şikâyetinde bulun",
        value: "report",
        emoji: "🛡️"
      },
      {
        label: "TRIER Tester Başvurusu",
        description: "Tester ekibine başvur",
        value: "tester",
        emoji: "🧪"
      },
      {
        label: "Yetkili Başvurusu",
        description: "Yetkili ekibine başvur",
        value: "staff",
        emoji: "👮"
      }
    );

  return {
    embeds: [
      embed(
        "🎫 SVEYDY PVP | Ticket Destek",
        "Destek almak veya başvuru yapmak için aşağıdaki menüden bir kategori seç.\n\n" +
        "💬 Genel Destek\n" +
        "🛡️ Şikâyet / Oyuncu\n" +
        "🧪 TRIER Tester Başvurusu\n" +
        "👮 Yetkili Başvurusu\n\n" +
        "Seçimini yaptıktan sonra formu doldur. Sana özel bir ticket kanalı açılacak."
      )
    ],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

function ticketModal(type) {
  const names = {
    general: "Genel Destek",
    report: "Oyuncu Şikâyeti",
    tester: "TRIER Tester Başvurusu",
    staff: "Yetkili Başvurusu"
  };

  const modal = new ModalBuilder()
    .setCustomId(`ticket_form_${type}`)
    .setTitle(names[type]);

  const mc = new TextInputBuilder()
    .setCustomId("minecraft")
    .setLabel("Minecraft kullanıcı adın")
    .setPlaceholder("Minecraft kullanıcı adını yaz")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  modal.addComponents(new ActionRowBuilder().addComponents(mc));

  if (type === "report") {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reported")
          .setLabel("Şikâyet edilen oyuncu")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      )
    );
  }

  if (type === "tester") {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("trier")
          .setLabel("TRIER'in nedir?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(500)
      )
    );
  }

  if (type === "staff") {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("role")
          .setLabel("Hangi yetkili rolünü istiyorsun?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      )
    );
  }

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("details")
        .setLabel(
          type === "general" ? "Sorunun nedir?" :
          type === "report" ? "Şikâyet açıklaması" :
          type === "tester" ? "Neden tester olmak istiyorsun?" :
          "Neden seni seçmeliyiz?"
        )
        .setPlaceholder("Açıklamanı yaz...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
    )
  );

  return modal;
}

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ticketpanel") {
        await interaction.channel.send(ticketPanel());
        return interaction.reply({
          content: "✅ Ticket paneli gönderildi.",
          ephemeral: true
        });
      }

      if (interaction.commandName === "ticketkategori") {
        const category = interaction.options.getChannel("kategori");
        config(interaction.guild.id).ticketCategory = category.id;
        writeData("settings.json", settings);

        return interaction.reply({
          content: `✅ Ticket kategorisi ayarlandı: ${category.name}`,
          ephemeral: true
        });
      }
    }

    if (interaction.isStringSelectMenu() &&
        interaction.customId === "ticket_select") {
      const type = interaction.values[0];

      const existing = Object.values(tickets).find(
        ticket =>
          ticket.guildId === interaction.guild.id &&
          ticket.userId === interaction.user.id &&
          ticket.status === "open"
      );

      if (existing) {
        const channel = await interaction.guild.channels
          .fetch(existing.channelId)
          .catch(() => null);

        if (channel) {
          return interaction.reply({
            content: `Zaten açık bir ticket'ın var: ${channel}`,
            ephemeral: true
          });
        }

        existing.status = "closed";
        writeData("tickets.json", tickets);
      }

      return interaction.showModal(ticketModal(type));
    }

    if (interaction.isModalSubmit() &&
        interaction.customId.startsWith("ticket_form_")) {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.customId.replace("ticket_form_", "");
      const categoryId = config(interaction.guild.id).ticketCategory;

      if (!categoryId) {
        return interaction.editReply(
          "❌ Ticket kategorisi ayarlanmamış. Yetkililer `/ticketkategori` kullanmalı."
        );
      }

      const category = await interaction.guild.channels
        .fetch(categoryId)
        .catch(() => null);

      if (!category || category.type !== ChannelType.GuildCategory) {
        return interaction.editReply(
          "❌ Ticket kategorisi bulunamadı. `/ticketkategori` ile tekrar ayarlayın."
        );
      }

      const minecraft = interaction.fields.getTextInputValue("minecraft");
      const details = interaction.fields.getTextInputValue("details");

      const typeNames = {
        general: "Genel Destek",
        report: "Şikâyet - Oyuncu",
        tester: "TRIER Tester Başvurusu",
        staff: "Yetkili Başvurusu"
      };

      const extra = [];
      if (type === "report") {
        extra.push(
          `**Şikâyet edilen oyuncu:** ${interaction.fields.getTextInputValue("reported")}`
        );
      }
      if (type === "tester") {
        extra.push(
          `**TRIER bilgisi:** ${interaction.fields.getTextInputValue("trier")}`
        );
      }
      if (type === "staff") {
        extra.push(
          `**İstenen rol:** ${interaction.fields.getTextInputValue("role")}`
        );
      }

      const overwrites = [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ];

      if (STAFF_ROLE_ID) {
        overwrites.push({
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      const safeName = minecraft
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 20) || "oyuncu";

      const channel = await interaction.guild.channels.create({
        name: `${type}-${safeName}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwrites,
        topic: `${typeNames[type]} | ${interaction.user.tag} | Minecraft: ${minecraft}`
      });

      tickets[channel.id] = {
        guildId: interaction.guild.id,
        channelId: channel.id,
        userId: interaction.user.id,
        minecraft,
        type,
        status: "open",
        createdAt: Date.now()
      };
      writeData("tickets.json", tickets);

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_${channel.id}`)
          .setLabel("Ticket'ı Kapat")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user}${STAFF_ROLE_ID ? ` <@&${STAFF_ROLE_ID}>` : ""}`,
        embeds: [
          embed(
            `🎫 ${typeNames[type]}`,
            [
              `**Kullanıcı:** ${interaction.user}`,
              `**Minecraft kullanıcı adı:** \`${minecraft}\``,
              ...extra,
              "",
              `**Açıklama:**\n${details}`
            ].join("\n")
          )
        ],
        components: [closeButton],
        allowedMentions: {
          users: [interaction.user.id],
          roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : []
        }
      });

      return interaction.editReply(`✅ Ticket oluşturuldu: ${channel}`);
    }

    if (interaction.isButton() &&
        interaction.customId.startsWith("ticket_close_")) {
      const channelId = interaction.customId.replace("ticket_close_", "");
      const ticket = tickets[channelId];

      if (!ticket || ticket.status !== "open") {
        return interaction.reply({
          content: "Bu ticket zaten kapatılmış veya bulunamadı.",
          ephemeral: true
        });
      }

      if (
        interaction.user.id !== ticket.userId &&
        !staff(interaction.member)
      ) {
        return interaction.reply({
          content: "Bu ticket'ı yalnızca açan kişi veya yetkililer kapatabilir.",
          ephemeral: true
        });
      }

      ticket.status = "closed";
      ticket.closedAt = Date.now();
      writeData("tickets.json", tickets);

      await interaction.reply("🔒 Ticket kapatılıyor. Kanal 5 saniye içinde silinecek.");

      setTimeout(async () => {
        await interaction.channel.delete("Ticket kapatıldı.").catch(console.error);
      }, 5000);
    }
  } catch (error) {
    console.error("İşlem hatası:", error);

    const message = "❌ Bir hata oluştu. Render Logs bölümünü kontrol et.";

    if (interaction.isRepliable()) {
      if (interaction.deferred) {
        await interaction.editReply(message).catch(() => {});
      } else if (!interaction.replied) {
        await interaction.reply({
          content: message,
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
});

client.on("guildMemberAdd", async member => {
  const roleId = config(member.guild.id).autoRole;
  if (!roleId) return;

  try {
    const role = await member.guild.roles.fetch(roleId);
    if (role && role.editable) {
      await member.roles.add(role, "Otomatik üye rolü");
    }
  } catch (error) {
    console.error("Otomatik rol verilemedi:", error);
  }
});

client.on("error", console.error);

process.on("unhandledRejection", error => {
  console.error("Beklenmeyen hata:", error);
});

client.login(TOKEN);
```
