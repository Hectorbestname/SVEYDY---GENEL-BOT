
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
const DEFAULT_APPLICATION_CHANNEL_ID =
  process.env.APPLICATION_CHANNEL_ID?.trim();

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
    (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID))
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
    .setDescription("Destek talebi paneli gönderir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("basvurupanel")
    .setDescription("Yetkili ve tester başvuru panelini gönderir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("logkanal")
    .setDescription("Log kanalını ayarlar")
    .addChannelOption(option =>
      option.setName("kanal")
        .setDescription("Logların gönderileceği kanal")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("basvurukanal")
    .setDescription("Başvuruların gönderileceği kanalı ayarlar")
    .addChannelOption(option =>
      option.setName("kanal")
        .setDescription("Başvuru kanalı")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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
        .setDescription("Süre (dakika)")
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
    .setDescription("Kanaldaki mesajları toplu siler")
    .addIntegerOption(option =>
      option.setName("adet")
        .setDescription("Silinecek mesaj sayısı (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Mevcut kanalı üyelerin mesaj yazmasına kapatır")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Mevcut kanalda mesaj yazmayı tekrar açar")
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

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Slash komutları yüklendi.");
  } catch (error) {
    console.error("Slash komutları yüklenemedi:", error);
  }

  client.user.setActivity("SVEYDY PVP | /help");
});

// ==================== TICKET PANELİ ====================

function ticketPanel() {
  const embed = makeEmbed(
    "🎫 SVEYDY PVP | Destek Merkezi",
    "Destek talebi açmak için bir kategori seç.\n\n" +
    "💬 **Genel Destek** — Yardım ve sorular\n" +
    "🛡️ **Şikâyet / Oyuncu** — Oyuncu şikâyetleri"
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
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;

  const existing = Object.values(tickets).find(ticket =>
    ticket.guildId === guild.id &&
    ticket.userId === interaction.user.id &&
    ticket.status === "open"
  );

  if (existing) {
    const existingChannel = guild.channels.cache.get(existing.channelId);

    if (existingChannel) {
      return ephemeral(interaction, `Zaten açık talebin var: ${existingChannel}`);
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

  const channel = await guild.channels.create({
    name: `${type === "report" ? "sikayet" : "destek"}-${safeName}`,
    type: ChannelType.GuildText,
    permissionOverwrites,
    reason: `${interaction.user.tag} tarafından ticket açıldı`
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
      .setLabel("Talebi Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${interaction.user}${staffRoleId ? ` <@&${staffRoleId}>` : ""}`,
    embeds: [
      makeEmbed(
        type === "report" ? "🛡️ Oyuncu Şikâyeti" : "💬 Genel Destek",
        "Talebin oluşturuldu. Sorununu ayrıntılı yaz ve yetkilinin yanıtını bekle."
      )
    ],
    components: [row],
    allowedMentions: {
      users: [interaction.user.id],
      roles: staffRoleId ? [staffRoleId] : []
    }
  });

  await ephemeral(interaction, `Talebin açıldı: ${channel}`);
  await sendLog(guild, "🎫 Yeni Ticket", `${interaction.user.tag} → ${channel} (${type})`);
}

// ==================== BAŞVURU PANELİ ====================

function applicationPanel() {
  const embed = makeEmbed(
    "📋 SVEYDY PVP | Başvuru Merkezi",
    "Başvurmak istediğin alanı seç.\n\n" +
    "👮 **Yetkili Olmak İstiyorum**\n" +
    "Rehber, Hile Kontrol, Moderatör, Admin veya başka bir görev.\n\n" +
    "🧪 **Tester Olmak İstiyorum**\n" +
    "Sunucudaki hataları ve sorunları test etmek için."
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("application_staff")
      .setLabel("Yetkili Olmak İstiyorum")
      .setEmoji("👮")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("application_tester")
      .setLabel("Tester Olmak İstiyorum")
      .setEmoji("🧪")
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function makeApplicationModal(type) {
  const isStaff = type === "staff";

  const modal = new ModalBuilder()
    .setCustomId(`application_modal_${type}`)
    .setTitle(isStaff ? "Yetkili Başvurusu" : "Tester Başvurusu");

  const mcName = new TextInputBuilder()
    .setCustomId("mc_name")
    .setLabel("Minecraft kullanıcı adın nedir?")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Minecraft kullanıcı adın")
    .setRequired(true)
    .setMaxLength(32);

  const rows = [
    new ActionRowBuilder().addComponents(mcName)
  ];

  if (isStaff) {
    const position = new TextInputBuilder()
      .setCustomId("position")
      .setLabel("Hangi görevde olmak istiyorsun?")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Rehber, Hile Kontrol, Moderatör, Admin...")
      .setRequired(true)
      .setMaxLength(100);

    const experience = new TextInputBuilder()
      .setCustomId("experience")
      .setLabel("Daha önce tecrüben var mı?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Önceki yetkililik deneyimini anlat.")
      .setRequired(true)
      .setMaxLength(1000);

    const reason = new TextInputBuilder()
      .setCustomId("reason")
      .setLabel("Neden seni seçmeliyiz?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Kendini ve ekibe ne katacağını anlat.")
      .setRequired(true)
      .setMaxLength(1000);

    rows.push(
      new ActionRowBuilder().addComponents(position),
      new ActionRowBuilder().addComponents(experience),
      new ActionRowBuilder().addComponents(reason)
    );
  } else {
    const trier = new TextInputBuilder()
      .setCustomId("trier")
      .setLabel("TRIER'in nedir?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("TRIER bilgin veya deneyimin")
      .setRequired(true)
      .setMaxLength(1000);

    rows.push(new ActionRowBuilder().addComponents(trier));
  }

  modal.addComponents(...rows);
  return modal;
}

async function submitApplication(interaction, type) {
  const isStaff = type === "staff";
  const config = guildSettings(interaction.guild.id);
  const channelId =
    config.applicationChannel || DEFAULT_APPLICATION_CHANNEL_ID;

  const channel = channelId
    ? interaction.guild.channels.cache.get(channelId)
    : null;

  if (!channel || !channel.isTextBased()) {
    return ephemeral(
      interaction,
      "Başvuru kanalı ayarlanmamış. Yönetici /basvurukanal komutunu kullanmalı."
    );
  }

  const mcName = interaction.fields.getTextInputValue("mc_name");

  const description = isStaff
    ? `**Discord:** ${interaction.user.tag}\n` +
      `**Minecraft adı:** ${mcName}\n` +
      `**İstediği görev:** ${interaction.fields.getTextInputValue("position")}\n` +
      `**Önceki tecrübe:** ${interaction.fields.getTextInputValue("experience")}\n` +
      `**Neden seçilmeli:** ${interaction.fields.getTextInputValue("reason")}`
    : `**Discord:** ${interaction.user.tag}\n` +
      `**Minecraft adı:** ${mcName}\n` +
      `**TRIER:** ${interaction.fields.getTextInputValue("trier")}`;

  const embed = makeEmbed(
    isStaff ? "👮 Yeni Yetkili Başvurusu" : "🧪 Yeni Tester Başvurusu",
    description
  ).setFooter({
    text: `Başvuru sahibi ID: ${interaction.user.id} | Tür: ${type}`
  });

  const uniqueId = `${interaction.user.id}_${Date.now()}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`application_accept_${uniqueId}`)
      .setLabel("Kabul Et")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`application_reject_${uniqueId}`)
      .setLabel("Reddet")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });

  await interaction.reply({
    content: "✅ Başvurun gönderildi! Yetkililer inceleyince sana dönüş yapacak.",
    ephemeral: true
  });

  await sendLog(
    interaction.guild,
    "📋 Yeni Başvuru",
    `${interaction.user.tag} bir ${isStaff ? "yetkili" : "tester"} başvurusu gönderdi.`
  );
}

// ==================== ETKİLEŞİMLER ====================

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      const guild = interaction.guild;

      if (commandName === "help") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              "📘 SVEYDY BOT KOMUTLARI",
              "**Genel:** `/ip`, `/serverinfo`, `/userinfo`, `/help`\n\n" +
              "**Destek ve başvuru:** `/ticketpanel`, `/basvurupanel`\n\n" +
              "**Yönetim:** `/logkanal`, `/basvurukanal`\n\n" +
              "**Moderasyon:** `/warn`, `/warnings`, `/timeout`, `/kick`, `/ban`, `/clear`, `/lock`, `/unlock`\n\n" +
              "**Şikâyet:** `/report`\n\n" +
              "**Sahipleri etiketle:** `!owner`"
            )
          ],
          ephemeral: true
        });
      }

      if (commandName === "ip") {
        return interaction.reply(
          `🌐 **SVEYDY PVP IP:** \`${SERVER_IP}\``
        );
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
        return ephemeral(interaction, "Ticket paneli gönderildi.");
      }

      if (commandName === "basvurupanel") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
          return ephemeral(interaction, "Bu komut için Kanal Yönet izni gerekli.");
        }
        await interaction.channel.send(applicationPanel());
        return ephemeral(interaction, "Başvuru paneli gönderildi.");
      }

      if (commandName === "logkanal") {
        const channel = interaction.options.getChannel("kanal");
        guildSettings(guild.id).logChannel = channel.id;
        saveData("settings.json", settings);
        return ephemeral(interaction, `Log kanalı ${channel} olarak ayarlandı.`);
      }

      if (commandName === "basvurukanal") {
        const channel = interaction.options.getChannel("kanal");
        guildSettings(guild.id).applicationChannel = channel.id;
        saveData("settings.json", settings);
        return ephemeral(interaction, `Başvuru kanalı ${channel} olarak ayarlandı.`);
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
        await sendLog(guild, "🧹 Mesajlar Silindi", `${interaction.user.tag}, ${interaction.channel} kanalında ${deleted.size} mesaj sildi.`);
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
        const logId = config.logChannel || DEFAULT_LOG_CHANNEL_ID;
        const logChannel = logId ? guild.channels.cache.get(logId) : null;

        if (!logChannel || !logChannel.isTextBased()) {
          return ephemeral(interaction, "Şikâyet kanalı ayarlanmamış. Yönetici /logkanal kullanmalı.");
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

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === "ticket_general") return createTicket(interaction, "general");
      if (id === "ticket_report") return createTicket(interaction, "report");

      if (id === "application_staff") {
        return interaction.showModal(makeApplicationModal("staff"));
      }

      if (id === "application_tester") {
        return interaction.showModal(makeApplicationModal("tester"));
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

      if (
        id.startsWith("application_accept_") ||
        id.startsWith("application_reject_")
      ) {
        if (!isStaff(interaction.member)) {
          return ephemeral(interaction, "Bu butonları yalnızca yetkililer kullanabilir.");
        }

        const accepted = id.startsWith("application_accept_");
        const applicantId = id.split("_")[2];

        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = originalEmbed
          ? EmbedBuilder.from(originalEmbed)
              .setColor(accepted ? 0x57f287 : 0xed4245)
              .setFooter({
                text: `${accepted ? "KABUL EDİLDİ" : "REDDEDİLDİ"} • ${interaction.user.tag}`
              })
          : makeEmbed("Başvuru Sonucu", accepted ? "Kabul edildi." : "Reddedildi.");

        const disabledRows = interaction.message.components.map(row =>
          new ActionRowBuilder().addComponents(
            row.components.map(component =>
              ButtonBuilder.from(component).setDisabled(true)
            )
          )
        );

        await interaction.update({
          embeds: [updatedEmbed],
          components: disabledRows
        });

        const applicant = await client.users.fetch(applicantId).catch(() => null);

        if (applicant) {
          await applicant.send(
            accepted
              ? "🎉 SVEYDY PVP başvurun kabul edildi! Yetkililer seninle iletişime geçecek."
              : "Başvurun maalesef reddedildi. İlgin için teşekkür ederiz."
          ).catch(() => {});
        }

        await sendLog(
          interaction.guild,
          accepted ? "✅ Başvuru Kabul Edildi" : "❌ Başvuru Reddedildi",
          `Başvuran: <@${applicantId}>\nİşlemi yapan: ${interaction.user.tag}`
        );
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "application_modal_staff") {
        return submitApplication(interaction, "staff");
      }

      if (interaction.customId === "application_modal_tester") {
        return submitApplication(interaction, "tester");
      }
    }
  } catch (error) {
    console.error("Interaction hatası:", error);

    if (interaction.isRepliable()) {
      await ephemeral(
        interaction,
        "Bir hata oluştu. Bot konsolundaki hatayı kontrol et."
      ).catch(() => {});
    }
  }
});

// ==================== MESAJ VE ÜYE LOGLARI ====================

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

client.on("guildMemberAdd", async member => {
  await sendLog(member.guild, "📥 Yeni Üye", `${member.user.tag} sunucuya katıldı.`);
});

client.on("guildMemberRemove", async member => {
  await sendLog(member.guild, "📤 Üye Ayrıldı", `${member.user.tag} sunucudan ayrıldı.`);
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
      allowedMentions: {
        users: OWNER_IDS
      }
    });
  }
});

client.on("error", error => console.error("Discord client hatası:", error));

process.on("unhandledRejection", error => {
  console.error("İşlenmeyen hata:", error);
});

client.login(TOKEN);
