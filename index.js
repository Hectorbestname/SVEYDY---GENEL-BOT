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

const TOKEN = process.env.DISCORD_TOKEN?.trim();
const CLIENT_ID = process.env.CLIENT_ID?.trim();
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID?.trim();
const DEFAULT_LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID?.trim();

const SERVER_IP = "sveydypvp.play.hosting";
const OWNER_IDS = [
  "1262510283092656194",
  "1075321059018027049"
];

const DATA_DIR = path.join(__dirname, "data");

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN ve CLIENT_ID ayarlarını kontrol et!");
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(file, fallback = {}) {
  const fullPath = path.join(DATA_DIR, file);

  try {
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, JSON.stringify(fallback, null, 2));
    }
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    console.error(`${file} okunamadı:`, error);
    return fallback;
  }
}

function saveData(file, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, file),
    JSON.stringify(data, null, 2)
  );
}

const settings = loadData("settings.json");
const warnings = loadData("warnings.json");
const tickets = loadData("tickets.json");

function guildSettings(guildId) {
  if (!settings[guildId]) settings[guildId] = {};
  return settings[guildId];
}

function isStaff(member) {
  if (!member) return false;

  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    Boolean(STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

function makeEmbed(title, description, color = 0x7c3aed) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function sendLog(guild, title, description) {
  const config = guildSettings(guild.id);
  const channelId = config.logChannel || DEFAULT_LOG_CHANNEL_ID;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return;

  try {
    await channel.send({
      embeds: [makeEmbed(title, description, 0x5865f2)]
    });
  } catch (error) {
    console.error("Log gönderilemedi:", error.message);
  }
}

async function ephemeral(interaction, message) {
  const payload = { content: message, ephemeral: true };

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload);
  }

  return interaction.reply(payload);
}

// ==================== SLASH KOMUTLARI ====================

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Bot komutlarını gösterir"),

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("Minecraft sunucu IP adresini gösterir"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Discord sunucusu bilgilerini gösterir"),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Destek ve başvuru panelini gönderir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("logkanal")
    .setDescription("Log kanalını ayarlar")
    .addChannelOption(option =>
      option.setName("kanal")
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
        .setDescription("Otomatik rol yönetimi")
        .addSubcommand(subcommand =>
          subcommand
            .setName("ayarla")
            .setDescription("Yeni üyelere verilecek rolü ayarlar")
            .addRoleOption(option =>
              option.setName("member")
                .setDescription("Otomatik verilecek rol")
                .setRequired(true)
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Bir kullanıcıya uyarı verir")
    .addUserOption(option =>
      option.setName("kullanici")
        .setDescription("Uyarılacak kişi")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Uyarı sebebi")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Kullanıcının uyarılarını gösterir")
    .addUserOption(option =>
      option.setName("kullanici")
        .setDescription("Kontrol edilecek kişi")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Bir kullanıcıyı geçici olarak susturur")
    .addUserOption(option =>
      option.setName("kullanici")
        .setDescription("Susturulacak kişi")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("dakika")
        .setDescription("Dakika")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Sebep")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Bir kullanıcıyı sunucudan atar")
    .addUserOption(option =>
      option.setName("kullanici")
        .setDescription("Atılacak kişi")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Sebep")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bir kullanıcıyı sunucudan yasaklar")
    .addUserOption(option =>
      option.setName("kullanici")
        .setDescription("Yasaklanacak kişi")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Sebep")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Mesajları toplu siler")
    .addIntegerOption(option =>
      option.setName("adet")
        .setDescription("1-100 arası")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Kanalı kilitler")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Kanal kilidini kaldırır")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Kullanıcı bilgilerini gösterir")
    .addUserOption(option =>
      option.setName("kullanici")
        .setDescription("Bilgileri gösterilecek kişi")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Bir üyeyi yetkililere bildirir")
    .addUserOption(option =>
      option.setName("kullanici")
        .setDescription("Şikâyet edilen kişi")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Şikâyet sebebi")
        .setRequired(true)
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

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} çevrimiçi!`);

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands
    });
    console.log("✅ Slash komutları yüklendi.");
  } catch (error) {
    console.error("Slash komutları yüklenemedi:", error);
  }

  client.user.setActivity("SVEYDY PVP | /help");
});

// ==================== TEK TICKET PANELİ ====================

function ticketPanel() {
  const embed = makeEmbed(
    "🎫 SVEYDY PVP | Destek ve Başvuru Merkezi",
    "İşlem yapmak istediğin kategoriyi aşağıdaki butonlardan seç.\n\n" +
    "💬 **Genel Destek** — Yardım ve sorular\n" +
    "🛡️ **Şikâyet / Oyuncu** — Oyuncu şikâyetleri\n" +
    "🧪 **TRIER Tester Olmak İstiyorum** — Tester başvurusu\n" +
    "👮 **Yetkili Başvurusu** — Ekibe katılma başvurusu"
  );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_general")
      .setLabel("Genel Destek")
      .setEmoji("💬")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("ticket_report")
      .setLabel("Şikâyet / Oyuncu")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_tester")
      .setLabel("TRIER Tester Olmak İstiyorum")
      .setEmoji("🧪")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("ticket_staff_application")
      .setLabel("Yetkili Başvurusu")
      .setEmoji("👮")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

// ==================== TICKET OLUŞTURMA ====================

async function createTicket(interaction, type) {
  const guild = interaction.guild;

  const existing = Object.values(tickets).find(ticket =>
    ticket.guildId === guild.id &&
    ticket.userId === interaction.user.id &&
    ticket.status === "open"
  );

  if (existing) {
    const channel = guild.channels.cache.get(existing.channelId);

    if (channel) {
      return ephemeral(interaction, `Zaten açık ticket'ın var: ${channel}`);
    }

    existing.status = "closed";
    saveData("tickets.json", tickets);
  }

  const safeName = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 18) || "uye";

  const config = guildSettings(guild.id);
  const staffRoleId = STAFF_ROLE_ID || config.staffRole;

  const permissionOverwrites = [
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
        PermissionFlagsBits.AttachFiles
      ]
    }
  ];

  if (staffRoleId && guild.roles.cache.has(staffRoleId)) {
    permissionOverwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const names = {
    general: "destek",
    report: "sikayet",
    tester: "trier-tester",
    staff: "yetkili-basvuru"
  };

  const channel = await guild.channels.create({
    name: `${names[type] || "ticket"}-${safeName}`,
    type: ChannelType.GuildText,
    permissionOverwrites,
    reason: `${interaction.user.tag} ticket açtı`
  });

  tickets[channel.id] = {
    guildId: guild.id,
    channelId: channel.id,
    userId: interaction.user.id,
    type,
    status: "open",
    createdAt: Date.now()
  };

  saveData("tickets.json", tickets);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_${channel.id}`)
      .setLabel("Ticketı Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  const titles = {
    general: "💬 Genel Destek",
    report: "🛡️ Şikâyet / Oyuncu",
    tester: "🧪 TRIER Tester Başvurusu",
    staff: "👮 Yetkili Başvurusu"
  };

  await channel.send({
    content: `${interaction.user}${staffRoleId ? ` <@&${staffRoleId}>` : ""}`,
    embeds: [
      makeEmbed(
        titles[type] || "🎫 Destek Talebi",
        type === "general"
          ? "Sorununu veya sorunu ayrıntılı şekilde yaz. Yetkililer seninle ilgilenecek."
          : type === "report"
            ? "Şikâyet ettiğin oyuncuyu ve olayın ayrıntılarını yaz."
            : "Başvuru formunu doldurduğun için teşekkürler. Yetkililer başvurunu burada inceleyecek."
      )
    ],
    components: [row],
    allowedMentions: {
      users: [interaction.user.id],
      roles: staffRoleId ? [staffRoleId] : []
    }
  });

  await ephemeral(interaction, `✅ Ticket açıldı: ${channel}`);

  await sendLog(
    guild,
    "🎫 Yeni Ticket",
    `${interaction.user.tag} → ${channel} (${type})`
  );

  return channel;
}

// ==================== BAŞVURU FORMU ====================

function makeApplicationModal(type) {
  const isStaffApplication = type === "staff";

  const modal = new ModalBuilder()
    .setCustomId(`ticket_application_${type}`)
    .setTitle(
      isStaffApplication
        ? "Yetkili Başvurusu"
        : "TRIER Tester Başvurusu"
    );

  const mcName = new TextInputBuilder()
    .setCustomId("mc_name")
    .setLabel("Minecraft kullanıcı adın")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Minecraft kullanıcı adını yaz")
    .setRequired(true)
    .setMaxLength(32);

  const rows = [
    new ActionRowBuilder().addComponents(mcName)
  ];

  if (isStaffApplication) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("position")
          .setLabel("Hangi görevde olmak istiyorsun?")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Rehber, Moderatör, Hile Kontrol...")
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("experience")
          .setLabel("Tecrüben var mı?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Neden seni seçmeliyiz?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
  } else {
    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("trier")
          .setLabel("TRIER deneyimin nedir?")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Tester deneyimini veya bildiklerini anlat")
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
  }

  modal.addComponents(...rows);
  return modal;
}

async function submitTicketApplication(interaction, type) {
  const guild = interaction.guild;
  const existing = Object.values(tickets).find(ticket =>
    ticket.guildId === guild.id &&
    ticket.userId === interaction.user.id &&
    ticket.status === "open"
  );

  if (existing && guild.channels.cache.has(existing.channelId)) {
    return ephemeral(
      interaction,
      `Zaten açık bir ticket'ın var: <#${existing.channelId}>`
    );
  }

  const mcName = interaction.fields.getTextInputValue("mc_name");

  let description =
    `**Discord:** ${interaction.user} (${interaction.user.tag})\n` +
    `**Minecraft kullanıcı adı:** ${mcName}\n`;

  if (type === "staff") {
    description +=
      `**İstenen görev:** ${interaction.fields.getTextInputValue("position")}\n` +
      `**Tecrübe:** ${interaction.fields.getTextInputValue("experience")}\n` +
      `**Neden seçilmeli:** ${interaction.fields.getTextInputValue("reason")}`;
  } else {
    description +=
      `**TRIER deneyimi:** ${interaction.fields.getTextInputValue("trier")}`;
  }

  const channel = await createApplicationTicketChannel(
    interaction,
    type,
    description
  );

  await interaction.reply({
    content: `✅ Başvurun gönderildi! Özel ticket'ın: ${channel}`,
    ephemeral: true
  });

  await sendLog(
    guild,
    "📋 Yeni Başvuru",
    `${interaction.user.tag} — ${type === "staff" ? "Yetkili" : "TRIER Tester"} başvurusu`
  );
}

async function createApplicationTicketChannel(interaction, type, description) {
  const guild = interaction.guild;
  const config = guildSettings(guild.id);
  const staffRoleId = STAFF_ROLE_ID || config.staffRole;

  const existing = Object.values(tickets).find(ticket =>
    ticket.guildId === guild.id &&
    ticket.userId === interaction.user.id &&
    ticket.status === "open"
  );

  if (existing) {
    const existingChannel = guild.channels.cache.get(existing.channelId);
    if (existingChannel) return existingChannel;
  }

  const safeName = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 18) || "uye";

  const channel = await guild.channels.create({
    name: `${type === "staff" ? "yetkili-basvuru" : "trier-tester"}-${safeName}`,
    type: ChannelType.GuildText,
    permissionOverwrites: [
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
          PermissionFlagsBits.AttachFiles
        ]
      },
      ...(staffRoleId && guild.roles.cache.has(staffRoleId)
        ? [{
            id: staffRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }]
        : [])
    ],
    reason: `${interaction.user.tag} başvuru ticketı açtı`
  });

  tickets[channel.id] = {
    guildId: guild.id,
    channelId: channel.id,
    userId: interaction.user.id,
    type: `application_${type}`,
    status: "open",
    createdAt: Date.now()
  };

  saveData("tickets.json", tickets);

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_${channel.id}`)
      .setLabel("Ticketı Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${interaction.user}${staffRoleId ? ` <@&${staffRoleId}>` : ""}`,
    embeds: [
      makeEmbed(
        type === "staff" ? "👮 Yetkili Başvurusu" : "🧪 TRIER Tester Başvurusu",
        description
      )
    ],
    components: [closeRow],
    allowedMentions: {
      users: [interaction.user.id],
      roles: staffRoleId ? [staffRoleId] : []
    }
  });

  return channel;
}

// ==================== ETKİLEŞİMLER ====================

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      const guild = interaction.guild;

      if (!guild) {
        return ephemeral(interaction, "Bu komut sunucuda kullanılmalı.");
      }

      if (commandName === "oto") {
        const role = interaction.options.getRole("member");
        const member = await guild.members.fetch(interaction.user.id);
        const botMember = await guild.members.fetchMe();

        if (
          !member.permissions.has(PermissionFlagsBits.ManageRoles) &&
          !member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          return ephemeral(interaction, "❌ Rolleri Yönet yetkin olmalı.");
        }

        if (role.id === guild.id || role.managed) {
          return ephemeral(interaction, "❌ Bu rol kullanılamaz.");
        }

        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          return ephemeral(interaction, "❌ Botta Rolleri Yönet izni yok.");
        }

        if (role.position >= botMember.roles.highest.position) {
          return ephemeral(
            interaction,
            "❌ Botun rolünü, verilecek rolün üstüne taşı."
          );
        }

        guildSettings(guild.id).autoRole = role.id;
        saveData("settings.json", settings);

        await sendLog(
          guild,
          "⚙️ Otomatik Rol Ayarlandı",
          `**Rol:** ${role}\n**Ayarlayan:** ${interaction.user.tag}`
        );

        return ephemeral(
          interaction,
          `✅ Otomatik rol ayarlandı: ${role}\nYeni üyelere bu rol verilecek.`
        );
      }

      if (commandName === "help") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              "📘 SVEYDY BOT KOMUTLARI",
              "**Genel:** `/ip`, `/serverinfo`, `/userinfo`, `/help`\n\n" +
              "**Ticket:** `/ticketpanel`\n\n" +
              "**Ayarlar:** `/logkanal`, `/oto rol ayarla`\n\n" +
              "**Moderasyon:** `/warn`, `/warnings`, `/timeout`, `/kick`, `/ban`, `/clear`, `/lock`, `/unlock`\n\n" +
              "**Şikâyet:** `/report`\n\n" +
              "**Sahipler:** `!owner`"
            )
          ],
          ephemeral: true
        });
      }

      if (commandName === "ip") {
        return interaction.reply(`🌐 **SVEYDY PVP IP:** \`${SERVER_IP}\``);
      }

      if (commandName === "serverinfo") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              `📊 ${guild.name}`,
              `**Üye sayısı:** ${guild.memberCount}\n` +
              `**Sunucu ID:** ${guild.id}\n` +
              `**Kanal sayısı:** ${guild.channels.cache.size}\n` +
              `**Rol sayısı:** ${guild.roles.cache.size}`
            )
          ]
        });
      }

      if (commandName === "ticketpanel") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
          return ephemeral(interaction, "Bu komut için Kanal Yönet izni gerekli.");
        }

        await interaction.channel.send(ticketPanel());
        return ephemeral(interaction, "✅ Destek ve başvuru paneli gönderildi.");
      }

      if (commandName === "logkanal") {
        const channel = interaction.options.getChannel("kanal");
        guildSettings(guild.id).logChannel = channel.id;
        saveData("settings.json", settings);
        return ephemeral(interaction, `Log kanalı ${channel} olarak ayarlandı.`);
      }

      if (commandName === "warn") {
        const user = interaction.options.getUser("kullanici");
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
          `${user.tag} — ${reason}\nYetkili: ${interaction.user.tag}`
        );

        return ephemeral(interaction, `⚠️ ${user.tag} uyarıldı. Sebep: ${reason}`);
      }

      if (commandName === "warnings") {
        const user = interaction.options.getUser("kullanici");
        const list = warnings[`${guild.id}_${user.id}`] || [];

        const description = list.length
          ? list.map((w, i) =>
              `**${i + 1}.** ${w.reason} — <@${w.moderator}> (<t:${Math.floor(w.date / 1000)}:R>)`
            ).join("\n")
          : "Bu kullanıcının kayıtlı uyarısı yok.";

        return interaction.reply({
          embeds: [makeEmbed(`⚠️ ${user.tag} — Uyarılar`, description)],
          ephemeral: true
        });
      }

      if (commandName === "timeout") {
        const user = interaction.options.getUser("kullanici");
        const minutes = interaction.options.getInteger("dakika");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (!member) return ephemeral(interaction, "Kullanıcı sunucuda bulunamadı.");
        if (!member.moderatable) return ephemeral(interaction, "Bu kullanıcıyı susturamıyorum. Rol sıralamasını kontrol et.");

        await member.timeout(minutes * 60 * 1000, reason);
        await sendLog(guild, "🔇 Timeout", `${user.tag} — ${minutes} dakika\nSebep: ${reason}`);
        return ephemeral(interaction, `${user.tag}, ${minutes} dakika susturuldu.`);
      }

      if (commandName === "kick") {
        const user = interaction.options.getUser("kullanici");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (!member) return ephemeral(interaction, "Kullanıcı sunucuda bulunamadı.");
        if (!member.kickable) return ephemeral(interaction, "Bu kullanıcıyı atamıyorum. Rol sıralamasını kontrol et.");

        await member.kick(reason);
        await sendLog(guild, "👢 Kullanıcı Atıldı", `${user.tag}\nSebep: ${reason}`);
        return ephemeral(interaction, `${user.tag} sunucudan atıldı.`);
      }

      if (commandName === "ban") {
        const user = interaction.options.getUser("kullanici");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (member && !member.bannable) {
          return ephemeral(interaction, "Bu kullanıcıyı yasaklayamıyorum. Rol sıralamasını kontrol et.");
        }

        await guild.members.ban(user.id, { reason });
        await sendLog(guild, "🔨 Kullanıcı Yasaklandı", `${user.tag}\nSebep: ${reason}`);
        return ephemeral(interaction, `${user.tag} sunucudan yasaklandı.`);
      }

      if (commandName === "clear") {
        const amount = interaction.options.getInteger("adet");
        const deleted = await interaction.channel.bulkDelete(amount, true);

        await sendLog(
          guild,
          "🧹 Mesajlar Silindi",
          `${interaction.user.tag}, ${interaction.channel} kanalında ${deleted.size} mesaj sildi.`
        );

        return ephemeral(interaction, `${deleted.size} mesaj silindi. 14 günden eski mesajlar toplu silinemez.`);
      }

      if (commandName === "lock" || commandName === "unlock") {
        const locked = commandName === "lock";

        await interaction.channel.permissionOverwrites.edit(
          guild.roles.everyone,
          { SendMessages: locked ? false : null }
        );

        await sendLog(
          guild,
          locked ? "🔒 Kanal Kilitlendi" : "🔓 Kanal Açıldı",
          `${interaction.channel} — ${interaction.user.tag}`
        );

        return ephemeral(interaction, locked ? "Kanal kilitlendi." : "Kanal kilidi kaldırıldı.");
      }

      if (commandName === "userinfo") {
        const user = interaction.options.getUser("kullanici") || interaction.user;
        const member = await guild.members.fetch(user.id).catch(() => null);

        const roles = member
          ? member.roles.cache
              .filter(role => role.id !== guild.id)
              .map(role => role.toString())
              .join(", ") || "Rol yok"
          : "Üye bilgisi alınamadı";

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x7c3aed)
              .setTitle(`👤 ${user.tag}`)
              .setThumbnail(user.displayAvatarURL())
              .setDescription(
                `**ID:** ${user.id}\n` +
                `**Hesap oluşturma:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>\n` +
                `**Sunucuya katılma:** ${member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Bilinmiyor"}\n` +
                `**Roller:** ${roles}`
              )
          ]
        });
      }

      if (commandName === "report") {
        const user = interaction.options.getUser("kullanici");
        const reason = interaction.options.getString("sebep");
        const config = guildSettings(guild.id);
        const logId = config.logChannel;
        const logChannel = logId ? guild.channels.cache.get(logId) : null;

        if (!logChannel || !logChannel.isTextBased()) {
          return ephemeral(interaction, "Önce /logkanal ile log kanalı ayarla.");
        }

        await logChannel.send({
          embeds: [
            makeEmbed(
              "🚨 Yeni Oyuncu Şikâyeti",
              `**Şikâyet eden:** ${interaction.user} (${interaction.user.tag})\n` +
              `**Şikâyet edilen:** ${user} (${user.tag})\n` +
              `**Sebep:** ${reason}`,
              0xed4245
            )
          ]
        });

        return ephemeral(interaction, "Şikâyetin yetkililere iletildi.");
      }
    }

    // ==================== BUTONLAR ====================

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === "ticket_general") return createTicket(interaction, "general");
      if (id === "ticket_report") return createTicket(interaction, "report");

      if (id === "ticket_tester") {
        return interaction.showModal(makeApplicationModal("tester"));
      }

      if (id === "ticket_staff_application") {
        return interaction.showModal(makeApplicationModal("staff"));
      }

      if (id.startsWith("ticket_close_")) {
        const channelId = id.slice("ticket_close_".length);
        const ticket = tickets[channelId];

        if (!ticket || ticket.status !== "open") {
          return ephemeral(interaction, "Bu ticket zaten kapatılmış.");
        }

        if (
          ticket.userId !== interaction.user.id &&
          !isStaff(interaction.member)
        ) {
          return ephemeral(interaction, "Bu ticketı yalnızca açan kişi veya yetkili kapatabilir.");
        }

        ticket.status = "closed";
        ticket.closedAt = Date.now();
        ticket.closedBy = interaction.user.id;
        saveData("tickets.json", tickets);

        await interaction.reply({
          embeds: [
            makeEmbed(
              "🔒 Ticket Kapatıldı",
              `Kapatan: ${interaction.user}\nKanal 5 saniye içinde silinecek.`
            )
          ]
        });

        await sendLog(
          interaction.guild,
          "🔒 Ticket Kapatıldı",
          `${interaction.channel.name} — ${interaction.user.tag}`
        );

        setTimeout(async () => {
          const channel = interaction.guild.channels.cache.get(channelId);
          if (channel) await channel.delete("Ticket kapatıldı").catch(() => {});
        }, 5000);

        return;
      }
    }

    // ==================== BAŞVURU MODALLARI ====================

    if (
      interaction.isModalSubmit() &&
      (
        interaction.customId === "ticket_application_staff" ||
        interaction.customId === "ticket_application_tester"
      )
    ) {
      const type = interaction.customId.endsWith("_staff") ? "staff" : "tester";
      return submitTicketApplication(interaction, type);
    }
  } catch (error) {
    console.error("Interaction hatası:", error);

    if (interaction.isRepliable()) {
      await ephemeral(
        interaction,
        "Bir hata oluştu. Render loglarını kontrol et."
      ).catch(() => {});
    }
  }
});

// ==================== MESAJ LOGLARI ====================

client.on("messageDelete", async message => {
  if (!message.guild || message.author?.bot) return;

  await sendLog(
    message.guild,
    "🗑️ Mesaj Silindi",
    `**Kullanıcı:** ${message.author?.tag || "Bilinmiyor"}\n` +
    `**Kanal:** ${message.channel}\n` +
    `**İçerik:** ${(message.content || "Metin içermiyor").slice(0, 1500)}`
  );
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  await sendLog(
    newMessage.guild,
    "✏️ Mesaj Düzenlendi",
    `**Kullanıcı:** ${newMessage.author?.tag || "Bilinmiyor"}\n` +
    `**Kanal:** ${newMessage.channel}\n` +
    `**Önce:** ${(oldMessage.content || "Bilinmiyor").slice(0, 700)}\n` +
    `**Sonra:** ${(newMessage.content || "Bilinmiyor").slice(0, 700)}`
  );
});

// ==================== OTOMATİK ROL ====================

client.on("guildMemberAdd", async member => {
  const roleId = guildSettings(member.guild.id).autoRole;

  if (roleId) {
    try {
      const role = await member.guild.roles.fetch(roleId);
      const botMember = await member.guild.members.fetchMe();

      if (!role) {
        console.error("Otomatik rol bulunamadı.");
      } else if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        console.error("Botta Rolleri Yönet izni yok.");
      } else if (role.position >= botMember.roles.highest.position) {
        console.error("Otomatik rol botun en yüksek rolünün altında olmalı.");
      } else {
        await member.roles.add(role, "Otomatik üye rolü");
        console.log(`${member.user.tag} kullanıcısına ${role.name} rolü verildi.`);
      }
    } catch (error) {
      console.error("Otomatik rol verilemedi:", error);
    }
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

// ==================== !ip VE !owner ====================

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const command = message.content.trim().toLowerCase();

  if (command === "!ip") {
    return message.reply({
      content: `🌐 **SVEYDY PVP IP:** \`${SERVER_IP}\``
    });
  }

  if (command === "!owner") {
    return message.reply({
      content:
        "👑 **SVEYDY PVP | SUNUCU SAHİPLERİ**\n" +
        "📌 Sahiplerle iletişime geç:\n" +
        "<@1262510283092656194>\n" +
        "<@1075321059018027049>",
      allowedMentions: { users: OWNER_IDS }
    });
  }
});

// ==================== HATA YÖNETİMİ ====================

client.on("error", error => console.error("Discord client hatası:", error));

process.on("unhandledRejection", error => {
  console.error("İşlenmeyen hata:", error);
});

client.login(TOKEN);
