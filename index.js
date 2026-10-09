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

const fs = require("node:fs");
const path = require("node:path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN veya CLIENT_ID eksik!");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

function readData(name) {
  const file = path.join(DATA_DIR, name);
  try {
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : {};
  } catch (error) {
    console.error(name + " okunamadı:", error);
    return {};
  }
}

function writeData(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

const settings = readData("settings.json");
const tickets = readData("tickets.json");

function config(guildId) {
  if (!settings[guildId]) settings[guildId] = {};
  return settings[guildId];
}

function makeEmbed(title, description, color = 0x7c3aed) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function isStaff(member) {
  if (!member) return false;
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
    .setDescription("Ticket panelini gönderir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketkategori")
    .setDescription("Ticket kategorisini ayarlar")
    .addChannelOption(option =>
      option
        .setName("kategori")
        .setDescription("Ticket kanallarının açılacağı kategori")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("oto-rol")
    .setDescription("Yeni üyeler için otomatik rol ayarlar")
    .addRoleOption(option =>
      option
        .setName("rol")
        .setDescription("Yeni üyeye verilecek rol")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log("Bot aktif: " + client.user.tag);

  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("Slash komutları kaydedildi.");
  } catch (error) {
    console.error("Komut kayıt hatası:", error);
  }

  client.user.setActivity("SVEYDY PVP | Destek");
});

function createTicketPanel() {
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
        description: "Oyuncu şikâyeti oluştur",
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
      makeEmbed(
        "🎫 SVEYDY PVP | Ticket Destek",
        "Destek almak veya başvuru yapmak için menüden bir kategori seç.\n\n" +
        "💬 Genel Destek\n" +
        "🛡️ Şikâyet / Oyuncu\n" +
        "🧪 TRIER Tester Başvurusu\n" +
        "👮 Yetkili Başvurusu\n\n" +
        "Formu doldurunca sana özel bir ticket kanalı açılacak."
      )
    ],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

function createTicketModal(type) {
  const names = {
    general: "Genel Destek",
    report: "Oyuncu Şikâyeti",
    tester: "TRIER Tester Başvurusu",
    staff: "Yetkili Başvurusu"
  };

  const modal = new ModalBuilder()
    .setCustomId("ticket_form_" + type)
    .setTitle(names[type]);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("minecraft")
        .setLabel("Minecraft kullanıcı adın")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32)
    )
  );

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
          .setLabel("İstediğin yetkili rolü")
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
        await interaction.channel.send(createTicketPanel());
        return interaction.reply({
          content: "Ticket paneli gönderildi.",
          ephemeral: true
        });
      }

      if (interaction.commandName === "ticketkategori") {
        const category = interaction.options.getChannel("kategori");
        config(interaction.guild.id).ticketCategory = category.id;
        writeData("settings.json", settings);

        return interaction.reply({
          content: "Ticket kategorisi ayarlandı: " + category.name,
          ephemeral: true
        });
      }

      if (interaction.commandName === "oto-rol") {
        const role = interaction.options.getRole("rol");
        config(interaction.guild.id).autoRole = role.id;
        writeData("settings.json", settings);

        return interaction.reply({
          content: "Otomatik rol ayarlandı: " + role.name,
          ephemeral: true
        });
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
      const type = interaction.values[0];

      const existing = Object.values(tickets).find(ticket =>
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
            content: "Zaten açık bir ticket'ın var: " + channel,
            ephemeral: true
          });
        }

        existing.status = "closed";
        writeData("tickets.json", tickets);
      }

      return interaction.showModal(createTicketModal(type));
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_form_")) {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.customId.replace("ticket_form_", "");
      const categoryId = config(interaction.guild.id).ticketCategory;

      if (!categoryId) {
        return interaction.editReply(
          "Önce /ticketkategori komutuyla ticket kategorisini ayarlayın."
        );
      }

      const category = await interaction.guild.channels
        .fetch(categoryId)
        .catch(() => null);

      if (!category || category.type !== ChannelType.GuildCategory) {
        return interaction.editReply(
          "Kategori bulunamadı. /ticketkategori ile tekrar ayarlayın."
        );
      }

      const minecraft = interaction.fields.getTextInputValue("minecraft");
      const details = interaction.fields.getTextInputValue("details");

      const names = {
        general: "Genel Destek",
        report: "Oyuncu Şikâyeti",
        tester: "TRIER Tester Başvurusu",
        staff: "Yetkili Başvurusu"
      };

      const extra = [];

      if (type === "report") {
        extra.push("**Şikâyet edilen oyuncu:** " + interaction.fields.getTextInputValue("reported"));
      }

      if (type === "tester") {
        extra.push("**TRIER bilgisi:** " + interaction.fields.getTextInputValue("trier"));
      }

      if (type === "staff") {
        extra.push("**İstenen rol:** " + interaction.fields.getTextInputValue("role"));
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

      const safeName = minecraft.toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 20) || "oyuncu";

      const channel = await interaction.guild.channels.create({
        name: type + "-" + safeName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwrites,
        topic: names[type] + " | " + interaction.user.tag + " | Minecraft: " + minecraft
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

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close_" + channel.id)
          .setLabel("Ticket'ı Kapat")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: interaction.user.toString() + (STAFF_ROLE_ID ? " <@&" + STAFF_ROLE_ID + ">" : ""),
        embeds: [
          makeEmbed(
            "🎫 " + names[type],
            [
              "**Kullanıcı:** " + interaction.user.toString(),
              "**Minecraft kullanıcı adı:** `" + minecraft + "`",
              ...extra,
              "",
              "**Açıklama:**\n" + details
            ].join("\n")
          )
        ],
        components: [closeRow],
        allowedMentions: {
          users: [interaction.user.id],
          roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : []
        }
      });

      return interaction.editReply("Ticket oluşturuldu: " + channel);
    }

    if (interaction.isButton() && interaction.customId.startsWith("ticket_close_")) {
      const channelId = interaction.customId.replace("ticket_close_", "");
      const ticket = tickets[channelId];

      if (!ticket || ticket.status !== "open") {
        return interaction.reply({
          content: "Bu ticket zaten kapatılmış veya bulunamadı.",
          ephemeral: true
        });
      }

      if (interaction.user.id !== ticket.userId && !isStaff(interaction.member)) {
        return interaction.reply({
          content: "Bu ticket'ı yalnızca açan kişi veya yetkililer kapatabilir.",
          ephemeral: true
        });
      }

      ticket.status = "closed";
      ticket.closedAt = Date.now();
      writeData("tickets.json", tickets);

      await interaction.reply("Ticket 5 saniye içinde kapatılacak.");

      setTimeout(async () => {
        await interaction.channel.delete("Ticket kapatıldı.").catch(console.error);
      }, 5000);
    }
  } catch (error) {
    console.error("İşlem hatası:", error);

    if (interaction.isRepliable()) {
      const message = "Bir hata oluştu. Render Logs bölümünü kontrol edin.";

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

client.on("error", error => console.error("Discord istemci hatası:", error));

process.on("unhandledRejection", error => {
  console.error("Beklenmeyen hata:", error);
});

client.login(TOKEN);
