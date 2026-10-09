```js
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
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

// ==================== AYARLAR ====================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "";

const SERVER_IP = "sveydypvp.play.hosting";
const OWNER_IDS = [
  "1262510283092656194",
  "1075321059018027049"
];

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN ve CLIENT_ID ayarlanmalı!");
  process.exit(1);
}

// ==================== VERİ DOSYALARI ====================

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(file) {
  const filePath = path.join(DATA_DIR, file);

  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "{}");
      return {};
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`${file} okunamadı:`, error);
    return {};
  }
}

function saveData(file, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, file),
    JSON.stringify(data, null, 2)
  );
}

let settings = loadData("settings.json");
let warnings = loadData("warnings.json");
let tickets = loadData("tickets.json");

function guildSettings(guildId) {
  if (!settings[guildId]) {
    settings[guildId] = {
      logChannel: LOG_CHANNEL_ID || null,
      ticketCategory: null,
      autoRole: null
    };
  }

  return settings[guildId];
}

function isStaff(member) {
  if (!member) return false;

  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID))
  );
}

function makeEmbed(title, description, color = 0x7C3AED) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function ephemeral(interaction, content) {
  const payload = { content, ephemeral: true };

  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload);
  }

  return interaction.reply(payload);
}

async function sendLog(guild, title, description) {
  try {
    const channelId = guildSettings(guild.id).logChannel;
    if (!channelId) return;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send({
      embeds: [makeEmbed(title, description, 0x5865F2)]
    });
  } catch (error) {
    console.error("Log gönderilemedi:", error);
  }
}

// ==================== TICKET PANELİ ====================

function ticketPanel() {
  const embed = makeEmbed(
    "🎫 SVEYDY PVP | Destek Merkezi",
    [
      "Destek almak veya başvuru yapmak için aşağıdaki seçeneklerden birini seç.",
      "",
      "💬 **Genel Destek**",
      "Soruların ve diğer konular için.",
      "",
      "🛡️ **Şikâyet / Oyuncu**",
      "Oyuncu şikâyeti ve kanıt göndermek için.",
      "",
      "🧪 **TRIER Tester Başvurusu**",
      "Tester ekibine katılmak için.",
      "",
      "👮 **Yetkili Başvurusu**",
      "Yetkili ekibine başvurmak için.",
      "",
      "🔒 Ticket kanalını yalnızca sen ve yetkililer görebilir.",
      "📌 Başlamadan önce Minecraft kullanıcı adın sorulacaktır."
    ].join("\n")
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_general")
      .setLabel("Genel Destek")
      .setEmoji("💬")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("ticket_report")
      .setLabel("Şikâyet / Oyuncu")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("ticket_tester")
      .setLabel("TRIER Tester")
      .setEmoji("🧪")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("ticket_staff")
      .setLabel("Yetkili Başvurusu")
      .setEmoji("👮")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// ==================== TICKET FORMLARI ====================

const TICKET_TYPES = {
  ticket_general: {
    key: "general",
    name: "Genel Destek",
    emoji: "💬",
    color: 0x5865F2
  },
  ticket_report: {
    key: "report",
    name: "Şikâyet - Oyuncu",
    emoji: "🛡️",
    color: 0xED4245
  },
  ticket_tester: {
    key: "tester",
    name: "TRIER Tester Başvurusu",
    emoji: "🧪",
    color: 0x57F287
  },
  ticket_staff: {
    key: "staff",
    name: "Yetkili Başvurusu",
    emoji: "👮",
    color: 0xFEE75C
  }
};

function addTextInput(modal, id, label, placeholder, style = TextInputStyle.Short) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setStyle(style)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );
}

function makeTicketModal(type) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${type}`)
    .setTitle(
      type === "general" ? "Genel Destek" :
      type === "report" ? "Oyuncu Şikâyeti" :
      type === "tester" ? "TRIER Tester Başvurusu" :
      "Yetkili Başvurusu"
    );

  addTextInput(
    modal,
    "minecraft_username",
    "Minecraft kullanıcı adın",
    "Örnek: Steve123"
  );

  if (type === "general") {
    addTextInput(
      modal,
      "ticket_details",
      "Nasıl yardımcı olabiliriz?",
      "Sorununu veya sorunu açıkla.",
      TextInputStyle.Paragraph
    );
  } else if (type === "report") {
    addTextInput(
      modal,
      "reported_player",
      "Şikâyet ettiğin oyuncu",
      "Oyuncunun Minecraft kullanıcı adı"
    );

    addTextInput(
      modal,
      "ticket_details",
      "Şikâyet ve kanıt bilgisi",
      "Olayı ve varsa kanıt bağlantısını yaz.",
      TextInputStyle.Paragraph
    );
  } else if (type === "tester") {
    addTextInput(
      modal,
      "trier",
      "TRIER'in nedir?",
      "TRIER hakkındaki bilgin ve deneyimin"
    );

    addTextInput(
      modal,
      "ticket_details",
      "Neden tester olmak istiyorsun?",
      "Kısaca kendini ve deneyimini anlat.",
      TextInputStyle.Paragraph
    );
  } else if (type === "staff") {
    addTextInput(
      modal,
      "desired_role",
      "Hangi yetkili rolünü istiyorsun?",
      "Örnek: Moderatör"
    );

    addTextInput(
      modal,
      "experience",
      "Önceki yetkili deneyimin",
      "Varsa sunucu ve deneyim bilgisi",
      TextInputStyle.Paragraph
    );

    addTextInput(
      modal,
      "ticket_details",
      "Neden seni seçmeliyiz?",
      "Başvurunu açıkla.",
      TextInputStyle.Paragraph
    );
  }

  return modal;
}

// ==================== TICKET OLUŞTURMA ====================

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 18) || "oyuncu";
}

async function createTicketFromModal(interaction, type) {
  const guild = interaction.guild;
  if (!guild) {
    return ephemeral(interaction, "Bu işlem yalnızca sunucuda kullanılabilir.");
  }

  const config = guildSettings(guild.id);

  if (!config.ticketCategory) {
    return ephemeral(
      interaction,
      "Ticket kategorisi ayarlanmamış. Yetkililer `/ticketkategori` komutunu kullanmalı."
    );
  }

  const category = await guild.channels
    .fetch(config.ticketCategory)
    .catch(() => null);

  if (!category || category.type !== ChannelType.GuildCategory) {
    return ephemeral(
      interaction,
      "Ayarlanan ticket kategorisi bulunamadı. Yetkililer `/ticketkategori` komutuyla tekrar ayarlamalı."
    );
  }

  const existing = Object.values(tickets).find(
    ticket =>
      ticket.guildId === guild.id &&
      ticket.userId === interaction.user.id &&
      ticket.status === "open"
  );

  if (existing) {
    const existingChannel = await guild.channels
      .fetch(existing.channelId)
      .catch(() => null);

    if (existingChannel) {
      return ephemeral(
        interaction,
        `Zaten açık bir ticket'ın var: ${existingChannel}`
      );
    }

    existing.status = "closed";
    saveData("tickets.json", tickets);
  }

  await interaction.deferReply({ ephemeral: true });

  const minecraftUsername = interaction.fields.getTextInputValue(
    "minecraft_username"
  );

  const details = interaction.fields.getTextInputValue("ticket_details");

  const typeInfo = TICKET_TYPES[`ticket_${type}`];
  const channelName = `${type}-${slugify(minecraftUsername)}`;

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  if (STAFF_ROLE_ID) {
    const staffRole = await guild.roles.fetch(STAFF_ROLE_ID).catch(() => null);

    if (staffRole) {
      overwrites.push({
        id: staffRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      });
    }
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `${typeInfo.name} | Minecraft: ${minecraftUsername} | Discord ID: ${interaction.user.id}`,
    permissionOverwrites: overwrites,
    reason: `Ticket açıldı: ${interaction.user.tag}`
  });

  const reportPlayer =
    type === "report"
      ? interaction.fields.getTextInputValue("reported_player")
      : null;

  const testerInfo =
    type === "tester"
      ? interaction.fields.getTextInputValue("trier")
      : null;

  const desiredRole =
    type === "staff"
      ? interaction.fields.getTextInputValue("desired_role")
      : null;

  const experience =
    type === "staff"
      ? interaction.fields.getTextInputValue("experience")
      : null;

  const ticketId = `${guild.id}-${channel.id}`;

  tickets[ticketId] = {
    guildId: guild.id,
    channelId: channel.id,
    userId: interaction.user.id,
    minecraftUsername,
    type,
    status: "open",
    createdAt: Date.now()
  };

  saveData("tickets.json", tickets);

  const description = [
    `**Kullanıcı:** ${interaction.user}`,
    `**Minecraft kullanıcı adı:** \`${minecraftUsername}\``,
    `**Ticket türü:** ${typeInfo.name}`,
    reportPlayer ? `**Şikâyet edilen oyuncu:** \`${reportPlayer}\`` : null,
    testerInfo ? `**TRIER bilgisi:** ${testerInfo}` : null,
    desiredRole ? `**İstenen rol:** ${desiredRole}` : null,
    experience ? `**Deneyim:** ${experience}` : null,
    "",
    "**Açıklama:**",
    details
  ].filter(Boolean).join("\n");

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_${channel.id}`)
      .setLabel("Ticket'ı Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${interaction.user}${STAFF_ROLE_ID ? ` <@&${STAFF_ROLE_ID}>` : ""}`,
    embeds: [
      makeEmbed(
        `${typeInfo.emoji} ${typeInfo.name}`,
        description,
        typeInfo.color
      )
    ],
    components: [closeRow],
    allowedMentions: {
      users: [interaction.user.id],
      roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : []
    }
  });

  await interaction.editReply({
    content: `✅ Ticket'ın açıldı: ${channel}`
  });

  await sendLog(
    guild,
    "🎫 Yeni Ticket",
    `**Tür:** ${typeInfo.name}\n**Kullanıcı:** ${interaction.user.tag}\n**Minecraft:** ${minecraftUsername}\n**Kanal:** ${channel}`
  );
}

async function closeTicket(interaction, channelId) {
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel) {
    return ephemeral(interaction, "Ticket kanalı bulunamadı.");
  }

  const ticket = Object.values(tickets).find(
    item =>
      item.channelId === channel.id &&
      item.guildId === interaction.guild.id &&
      item.status === "open"
  );

  if (!ticket) {
    return ephemeral(interaction, "Bu kanal açık bir ticket olarak kayıtlı değil.");
  }

  const isOwner = ticket.userId === interaction.user.id;

  if (!isOwner && !isStaff(interaction.member)) {
    return ephemeral(
      interaction,
      "Bu ticket'ı yalnızca açan kişi veya yetkililer kapatabilir."
    );
  }

  ticket.status = "closed";
  ticket.closedAt = Date.now();
  ticket.closedBy = interaction.user.id;
  saveData("tickets.json", tickets);

  await interaction.reply({
    embeds: [
      makeEmbed(
        "🔒 Ticket Kapatılıyor",
        `Ticket ${interaction.user} tarafından kapatıldı. Kanal 5 saniye içinde silinecek.`,
        0xED4245
      )
    ]
  });

  await sendLog(
    interaction.guild,
    "🔒 Ticket Kapatıldı",
    `**Kanal:** ${channel.name}\n**Kapatan:** ${interaction.user.tag}`
  );

  setTimeout(async () => {
    try {
      await channel.delete("Ticket kapatıldı.");
    } catch (error) {
      console.error("Ticket kanalı silinemedi:", error);
    }
  }, 5000);
}

// ==================== SLASH KOMUTLARI ====================

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Bot komutlarını gösterir"),

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("Minecraft sunucusunun IP adresini gösterir"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Discord sunucu bilgilerini gösterir"),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Destek ve başvuru ticket panelini gönderir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ticketkategori")
    .setDescription("Ticket kanallarının açılacağı kategoriyi ayarlar")
    .addChannelOption(option =>
      option
        .setName("kategori")
        .setDescription("Ticket kategorisi")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("logkanal")
    .setDescription("Log kanalını ayarlar")
    .addChannelOption(option =>
      option
        .setName("kanal")
        .setDescription("Log kanalı")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("oto")
    .setDescription("Otomatik rol ayarları")
    .addSubcommandGroup(group =>
      group
        .setName("rol")
        .setDescription("Otomatik üye rolü")
        .addSubcommand(sub =>
          sub
            .setName("ayarla")
            .setDescription("Yeni üyelerin alacağı rolü ayarlar")
            .addRoleOption(option =>
              option
                .setName("rol")
                .setDescription("Yeni üyeye verilecek rol")
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName("kapat")
            .setDescription("Otomatik rol sistemini kapatır")
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Bir kullanıcıya uyarı verir")
    .addUserOption(option =>
      option.setName("kullanıcı").setDescription("Uyarılacak kullanıcı").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep").setDescription("Uyarı sebebi").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Bir kullanıcının uyarılarını gösterir")
    .addUserOption(option =>
      option.setName("kullanıcı").setDescription("Uyarıları gösterilecek kullanıcı").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Bir kullanıcıya zaman aşımı uygular")
    .addUserOption(option =>
      option.setName("kullanıcı").setDescription("Kullanıcı").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("dakika").setDescription("Dakika").setMinValue(1).setMaxValue(40320).setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep").setDescription("Sebep").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Bir kullanıcıyı sunucudan atar")
    .addUserOption(option =>
      option.setName("kullanıcı").setDescription("Atılacak kullanıcı").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep").setDescription("Sebep").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bir kullanıcıyı sunucudan yasaklar")
    .addUserOption(option =>
      option.setName("kullanıcı").setDescription("Yasaklanacak kullanıcı").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep").setDescription("Sebep").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Mesajları toplu siler")
    .addIntegerOption(option =>
      option.setName("sayı").setDescription("Silinecek mesaj sayısı").setMinValue(1).setMaxValue(100).setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Mevcut kanalı kilitler")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Mevcut kanalın kilidini açar")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Kullanıcı bilgilerini gösterir")
    .addUserOption(option =>
      option.setName("kullanıcı").setDescription("Bilgileri gösterilecek kullanıcı").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Bir kullanıcıyı yetkililere bildirir")
    .addUserOption(option =>
      option.setName("kullanıcı").setDescription("Şikâyet edilen kullanıcı").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep").setDescription("Şikâyet sebebi").setRequired(true)
    )
].map(command => command.toJSON());

// ==================== BOT ====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.User
  ]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} olarak giriş yapıldı.`);

  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Slash komutları kaydedildi.");
  } catch (error) {
    console.error("Slash komutları kaydedilemedi:", error);
  }

  client.user.setActivity("SVEYDY PVP | /help");
});

// ==================== KOMUT İŞLEMLERİ ====================

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      const guild = interaction.guild;

      if (commandName === "help") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              "📚 SVEYDY PVP | Komutlar",
              [
                "**Genel**",
                "`/help` — Komut listesi",
                "`/ip` — Minecraft IP",
                "`/serverinfo` — Sunucu bilgileri",
                "`/userinfo` — Kullanıcı bilgileri",
                "",
                "**Ticket sistemi**",
                "`/ticketkategori` — Ticket kategorisini ayarla",
                "`/ticketpanel` — Ticket panelini gönder",
                "",
                "**Yetkili**",
                "`/oto rol ayarla` — Otomatik rol ayarla",
                "`/oto rol kapat` — Otomatik rolü kapat",
                "`/logkanal` — Log kanalı ayarla",
                "`/warn` — Uyarı",
                "`/warnings` — Uyarı geçmişi",
                "`/timeout` — Zaman aşımı",
                "`/kick` — Kullanıcı at",
                "`/ban` — Kullanıcı yasakla",
                "`/clear` — Mesaj sil",
                "`/lock` — Kanal kilitle",
                "`/unlock` — Kanal kilidini aç",
                "`/report` — Şikâyet bildir"
              ].join("\n")
            )
          ],
          ephemeral: true
        });
      }

      if (commandName === "ip") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              "🌐 SVEYDY PVP",
              `**Minecraft IP:** \`${SERVER_IP}\``
            )
          ]
        });
      }

      if (commandName === "serverinfo") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              "📊 Sunucu Bilgileri",
              [
                `**Sunucu:** ${guild.name}`,
                `**Üye sayısı:** ${guild.memberCount}`,
                `**Oluşturulma:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
                `**Sunucu sahibi:** <@${guild.ownerId}>`
              ].join("\n")
            )
          ]
        });
      }

      if (commandName === "ticketpanel") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
          return ephemeral(interaction, "Bu komut için Kanal Yönetimi izni gerekiyor.");
        }

        return interaction.channel.send(ticketPanel()).then(() =>
          ephemeral(interaction, "✅ Ticket paneli gönderildi.")
        );
      }

      if (commandName === "ticketkategori") {
        const category = interaction.options.getChannel("kategori");

        guildSettings(guild.id).ticketCategory = category.id;
        saveData("settings.json", settings);

        return ephemeral(
          interaction,
          `✅ Ticket kategorisi ayarlandı: **${category.name}**`
        );
      }

      if (commandName === "logkanal") {
        const channel = interaction.options.getChannel("kanal");

        guildSettings(guild.id).logChannel = channel.id;
        saveData("settings.json", settings);

        return ephemeral(interaction, `✅ Log kanalı ayarlandı: ${channel}`);
      }

      if (commandName === "oto") {
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (group === "rol" && subcommand === "ayarla") {
          const role = interaction.options.getRole("rol");

          guildSettings(guild.id).autoRole = role.id;
          saveData("settings.json", settings);

          return ephemeral(
            interaction,
            `✅ Otomatik rol ayarlandı: ${role}\nYeni katılan üyelere bu rol verilecek. Botun rolü, verilecek rolün üstünde olmalı.`
          );
        }

        if (group === "rol" && subcommand === "kapat") {
          guildSettings(guild.id).autoRole = null;
          saveData("settings.json", settings);

          return ephemeral(interaction, "✅ Otomatik rol sistemi kapatıldı.");
        }
      }

      if (commandName === "warn") {
        const user = interaction.options.getUser("kullanıcı");
        const reason = interaction.options.getString("sebep");

        const key = `${guild.id}_${user.id}`;

        if (!warnings[key]) warnings[key] = [];

        warnings[key].push({
          reason,
          moderator: interaction.user.id,
          date: Date.now()
        });

        saveData("warnings.json", warnings);

        await sendLog(
          guild,
          "⚠️ Kullanıcı Uyarıldı",
          `**Kullanıcı:** ${user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`
        );

        return ephemeral(interaction, `⚠️ ${user.tag} uyarıldı. Sebep: ${reason}`);
      }

      if (commandName === "warnings") {
        const user = interaction.options.getUser("kullanıcı");
        const list = warnings[`${guild.id}_${user.id}`] || [];

        const description = list.length
          ? list.map((item, index) =>
              `**${index + 1}.** ${item.reason}\nYetkili: <@${item.moderator}> • <t:${Math.floor(item.date / 1000)}:R>`
            ).join("\n\n")
          : "Bu kullanıcının kayıtlı uyarısı yok.";

        return interaction.reply({
          embeds: [makeEmbed(`⚠️ ${user.tag} | Uyarılar`, description)],
          ephemeral: true
        });
      }

      if (commandName === "timeout") {
        const user = interaction.options.getUser("kullanıcı");
        const minutes = interaction.options.getInteger("dakika");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";

        const member = await guild.members.fetch(user.id);

        if (!member.moderatable) {
          return ephemeral(interaction, "Bu kullanıcıya zaman aşımı uygulayamıyorum.");
        }

        await member.timeout(minutes * 60 * 1000, reason);

        await sendLog(
          guild,
          "⏳ Timeout",
          `**Kullanıcı:** ${user.tag}\n**Süre:** ${minutes} dakika\n**Sebep:** ${reason}`
        );

        return ephemeral(interaction, `✅ ${user.tag} ${minutes} dakika timeout aldı.`);
      }

      if (commandName === "kick") {
        const user = interaction.options.getUser("kullanıcı");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (!member || !member.kickable) {
          return ephemeral(interaction, "Bu kullanıcıyı atamıyorum.");
        }

        await member.kick(reason);

        await sendLog(
          guild,
          "👢 Kullanıcı Atıldı",
          `**Kullanıcı:** ${user.tag}\n**Sebep:** ${reason}`
        );

        return ephemeral(interaction, `✅ ${user.tag} sunucudan atıldı.`);
      }

      if (commandName === "ban") {
        const user = interaction.options.getUser("kullanıcı");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (member && !member.bannable) {
          return ephemeral(interaction, "Bu kullanıcıyı yasaklayamıyorum.");
        }

        await guild.members.ban(user.id, { reason });

        await sendLog(
          guild,
          "🔨 Kullanıcı Yasaklandı",
          `**Kullanıcı:** ${user.tag}\n**Sebep:** ${reason}`
        );

        return ephemeral(interaction, `✅ ${user.tag} yasaklandı.`);
      }

      if (commandName === "clear") {
        const amount = interaction.options.getInteger("sayı");

        const deleted = await interaction.channel.bulkDelete(amount, true);

        return ephemeral(interaction, `✅ ${deleted.size} mesaj silindi.`);
      }

      if (commandName === "lock" || commandName === "unlock") {
        const locked = commandName === "lock";

        await interaction.channel.permissionOverwrites.edit(
          guild.roles.everyone,
          { SendMessages: !locked }
        );

        return interaction.reply({
          embeds: [
            makeEmbed(
              locked ? "🔒 Kanal Kilitlendi" : "🔓 Kanal Açıldı",
              `İşlem: ${interaction.channel}`
            )
          ]
        });
      }

      if (commandName === "userinfo") {
        const user =
          interaction.options.getUser("kullanıcı") || interaction.user;

        const member = await guild.members.fetch(user.id).catch(() => null);

        return interaction.reply({
          embeds: [
            makeEmbed(
              "👤 Kullanıcı Bilgileri",
              [
                `**Kullanıcı:** ${user.tag}`,
                `**ID:** ${user.id}`,
                `**Hesap oluşturulma:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
                member
                  ? `**Sunucuya katılma:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
                  : ""
              ].filter(Boolean).join("\n")
            ).setThumbnail(user.displayAvatarURL())
          ]
        });
      }

      if (commandName === "report") {
        const user = interaction.options.getUser("kullanıcı");
        const reason = interaction.options.getString("sebep");

        const logChannelId = guildSettings(guild.id).logChannel;
        const logChannel = logChannelId
          ? await guild.channels.fetch(logChannelId).catch(() => null)
          : null;

        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({
            embeds: [
              makeEmbed(
                "🚨 Yeni Oyuncu Şikâyeti",
                `**Şikâyet eden:** ${interaction.user}\n**Şikâyet edilen:** ${user}\n**Sebep:** ${reason}`,
                0xED4245
              )
            ]
          });
        }

        return ephemeral(interaction, "✅ Şikâyetin yetkililere iletildi.");
      }
    }

    // ==================== BUTONLAR ====================

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (TICKET_TYPES[id]) {
        const type = TICKET_TYPES[id].key;
        return interaction.showModal(makeTicketModal(type));
      }

      if (id.startsWith("ticket_close_")) {
        const channelId = id.slice("ticket_close_".length);
        return closeTicket(interaction, channelId);
      }
    }

    // ==================== FORM GÖNDERİMİ ====================

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("ticket_modal_")) {
        const type = interaction.customId.slice("ticket_modal_".length);

        if (!["general", "report", "tester", "staff"].includes(type)) {
          return ephemeral(interaction, "Geçersiz ticket türü.");
        }

        return createTicketFromModal(interaction, type);
      }
    }
  } catch (error) {
    console.error("Interaction hatası:", error);

    if (interaction.isRepliable()) {
      await ephemeral(
        interaction,
        "Bir hata oluştu. Bot konsolundaki hatayı kontrol edin."
      ).catch(() => {});
    }
  }
});

// ==================== ÜYE GİRİŞ / ÇIKIŞ ====================

client.on("guildMemberAdd", async member => {
  try {
    const roleId = guildSettings(member.guild.id).autoRole;

    if (roleId) {
      const role = await member.guild.roles.fetch(roleId).catch(() => null);

      if (role && role.editable) {
        await member.roles.add(role, "Otomatik üye rolü");
      } else {
        console.error(
          "Otomatik rol verilemedi: Rol bulunamadı veya bot rolü yeterince yukarıda değil."
        );
      }
    }
  } catch (error) {
    console.error("Otomatik rol hatası:", error);
  }

  await sendLog(
    member.guild,
    "📥 Yeni Üye",
    `${member.user.tag} sunucuya katıldı.`
  );
});

client.on("guildMemberRemove", async member => {
  await sendLog(
    member.guild,
    "📤 Üye Ayrıldı",
    `${member.user.tag} sunucudan ayrıldı.`
  );
});

// ==================== MESAJ LOG ====================

client.on("messageDelete", async message => {
  if (!message.guild || message.author?.bot) return;

  await sendLog(
    message.guild,
    "🗑️ Mesaj Silindi",
    `**Kanal:** ${message.channel}\n**Kullanıcı:** ${message.author?.tag || "Bilinmiyor"}\n**Mesaj:** ${message.content || "Metin içermiyor"}`
  );
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  await sendLog(
    newMessage.guild,
    "✏️ Mesaj Düzenlendi",
    `**Kanal:** ${newMessage.channel}\n**Kullanıcı:** ${newMessage.author?.tag || "Bilinmiyor"}\n**Önce:** ${oldMessage.content || "Bilinmiyor"}\n**Sonra:** ${newMessage.content || "Bilinmiyor"}`
  );
});

// ==================== BASİT MESAJ KOMUTLARI ====================

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  if (message.content.trim() === "!ip") {
    await message.reply(`🌐 Minecraft IP: \`${SERVER_IP}\``);
  }

  if (message.content.trim() === "!owner") {
    await message.reply(
      `👑 Sunucu sahipleri: ${OWNER_IDS.map(id => `<@${id}>`).join(", ")}`
    );
  }
});

// ==================== HATA YÖNETİMİ ====================

client.on("error", error => {
  console.error("Discord istemci hatası:", error);
});

process.on("unhandledRejection", error => {
  console.error("Yakalanmamış Promise hatası:", error);
});

client.login(TOKEN);
```
