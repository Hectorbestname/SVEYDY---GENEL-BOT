const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ==================== AYARLAR ====================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";

const SERVER_IP = "sveydypvp.play.hosting";

const OWNER_IDS = [
  "1262510283092656194",
  "1075321059018027049"
];

if (!TOKEN) {
  console.error("HATA: Render Environment Variables bölümüne DISCORD_TOKEN ekle!");
  process.exit(1);
}

// ==================== DOSYA SİSTEMİ ====================

const dataDir = __dirname;

const settingsFile = path.join(dataDir, "settings.json");
const warningsFile = path.join(dataDir, "warnings.json");
const ticketsFile = path.join(dataDir, "tickets.json");

function loadJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`${path.basename(file)} okunamadı:`, error);
    return fallback;
  }
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`${path.basename(file)} kaydedilemedi:`, error);
  }
}

let settings = loadJSON(settingsFile, {});
let warnings = loadJSON(warningsFile, {});
let tickets = loadJSON(ticketsFile, {});

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
    Partials.GuildMember
  ]
});

const purple = 0x8B5CF6;

function makeEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(purple)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function isOwner(userId) {
  return OWNER_IDS.includes(userId);
}

function isStaff(member) {
  if (!member) return false;

  return (
    isOwner(member.id) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID))
  );
}

async function sendLog(guild, embed) {
  if (!guild) return;

  const channelId = settings[guild.id]?.logChannelId;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return;

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Log gönderilemedi:", error.message);
  }
}

function getTicketCategory(guildId, type) {
  return settings[guildId]?.ticketCategories?.[type] || null;
}

function saveSettings() {
  saveJSON(settingsFile, settings);
}

function saveWarnings() {
  saveJSON(warningsFile, warnings);
}

function saveTickets() {
  saveJSON(ticketsFile, tickets);
}

// ==================== SLASH KOMUTLARI ====================

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Botun komutlarını gösterir."),

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("Minecraft sunucusunun IP adresini gösterir."),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Discord sunucusu bilgilerini gösterir."),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Ticket açma panelini gönderir.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("ticketkategori")
    .setDescription("Bir ticket türü için kategori ayarlar.")
    .addStringOption(option =>
      option.setName("tur")
        .setDescription("Hangi ticket türü?")
        .setRequired(true)
        .addChoices(
          { name: "Genel Destek", value: "destek" },
          { name: "Şikâyet / Oyuncu", value: "sikayet" },
          { name: "TRIER Tester Başvurusu", value: "tester" },
          { name: "Yetkili Başvurusu", value: "yetkili" }
        )
    )
    .addChannelOption(option =>
      option.setName("kategori")
        .setDescription("Ticket kanallarının açılacağı kategori.")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("oto-rol")
    .setDescription("Sunucuya yeni girenlere verilecek rolü ayarlar.")
    .addRoleOption(option =>
      option.setName("rol")
        .setDescription("Otomatik verilecek rol.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("logkanal")
    .setDescription("Botun log kanalını ayarlar.")
    .addChannelOption(option =>
      option.setName("kanal")
        .setDescription("Logların gönderileceği metin kanalı.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Bir üyeye uyarı verir.")
    .addUserOption(option =>
      option.setName("uye")
        .setDescription("Uyarılacak üye.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Uyarı sebebi.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Bir üyenin uyarılarını gösterir.")
    .addUserOption(option =>
      option.setName("uye")
        .setDescription("Uyarıları görüntülenecek üye.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Bir üyeyi süreli olarak susturur.")
    .addUserOption(option =>
      option.setName("uye")
        .setDescription("Susturulacak üye.")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("dakika")
        .setDescription("Susturma süresi (dakika).")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Susturma sebebi.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Bir üyeyi sunucudan atar.")
    .addUserOption(option =>
      option.setName("uye")
        .setDescription("Atılacak üye.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Atılma sebebi.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bir üyeyi sunucudan yasaklar.")
    .addUserOption(option =>
      option.setName("uye")
        .setDescription("Yasaklanacak üye.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Yasaklama sebebi.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Kanaldaki mesajları siler.")
    .addIntegerOption(option =>
      option.setName("adet")
        .setDescription("Silinecek mesaj sayısı (1-100).")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Bu kanalda üyelerin mesaj yazmasını kapatır.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Bu kanalda mesaj yazmayı yeniden açar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Bir üyenin bilgilerini gösterir.")
    .addUserOption(option =>
      option.setName("uye")
        .setDescription("Bilgileri görüntülenecek üye.")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Bir üyeyi yetkililere bildirir.")
    .addUserOption(option =>
      option.setName("uye")
        .setDescription("Şikâyet edilen üye.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("sebep")
        .setDescription("Şikâyet sebebi.")
        .setRequired(true)
    )
].map(command => command.toJSON());

// ==================== BOT AÇILIŞI ====================

client.once("ready", async () => {
  console.log(`Bot aktif: ${client.user.tag}`);

  try {
    if (CLIENT_ID) {
      await client.application.commands.set(commands);
      console.log("Slash komutları kaydedildi.");
    } else {
      await client.application.commands.set(commands);
      console.log("Slash komutları kaydedildi. CLIENT_ID ayrıca tanımlanmadı.");
    }
  } catch (error) {
    console.error("Slash komutları kaydedilemedi:", error);
  }

  client.user.setActivity("SVEYDY • Minecraft", {
    type: 0
  });
});

// ==================== YARDIM PANELİ ====================

function helpEmbed() {
  return makeEmbed(
    "SVEYDY • Bot Komutları",
    "**Genel Komutlar**\n" +
    "`/help` — Komut listesi\n" +
    "`/ip` veya `!ip` — Minecraft IP\n" +
    "`/serverinfo` — Sunucu bilgileri\n" +
    "`/userinfo` — Üye bilgileri\n" +
    "`/report` — Üye bildirimi\n\n" +
    "**Ticket Komutları**\n" +
    "`/ticketpanel` — Ticket panelini gönderir\n" +
    "`/ticketkategori` — Ticket kategorisini ayarlar\n\n" +
    "**Yetkili Komutları**\n" +
    "`/warn` — Uyarı verir\n" +
    "`/warnings` — Uyarıları görüntüler\n" +
    "`/timeout` — Üyeyi susturur\n" +
    "`/kick` — Üyeyi atar\n" +
    "`/ban` — Üyeyi yasaklar\n" +
    "`/clear` — Mesajları siler\n" +
    "`/lock` — Kanalı kilitler\n" +
    "`/unlock` — Kanal kilidini açar\n\n" +
    "**Yönetim Komutları**\n" +
    "`/oto-rol` — Otomatik rol ayarlar\n" +
    "`/logkanal` — Log kanalını ayarlar\n\n" +
    "**Sahip Komutları**\n" +
    "`!owner` — Bot sahiplerini gösterir"
  );
}

// ==================== TICKET PANELİ ====================

function ticketPanelEmbed() {
  return makeEmbed(
    "🎫 SVEYDY • Destek Merkezi",
    "Aşağıdaki menüden ihtiyacına uygun ticket türünü seç.\n\n" +
    "💬 **Genel Destek** — Yardım ve sorular\n" +
    "🛡️ **Şikâyet / Oyuncu** — Oyuncu şikâyeti\n" +
    "🧪 **TRIER Tester Başvurusu** — Tester başvurusu\n" +
    "👮 **Yetkili Başvurusu** — Yetkili ekibine katılma\n\n" +
    "Seçimini yaptığında sana özel bir ticket açılır."
  );
}

function ticketMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("🎫 Ticket Kategorisini Seç...")
      .addOptions(
        {
          label: "Genel Destek",
          description: "Yardım ve genel sorular.",
          value: "destek",
          emoji: "💬"
        },
        {
          label: "Şikâyet / Oyuncu",
          description: "Bir oyuncu hakkında şikâyet oluştur.",
          value: "sikayet",
          emoji: "🛡️"
        },
        {
          label: "TRIER Tester Başvurusu",
          description: "TRIER tester ekibine başvur.",
          value: "tester",
          emoji: "🧪"
        },
        {
          label: "Yetkili Başvurusu",
          description: "Yetkili ekibine katılmak için başvur.",
          value: "yetkili",
          emoji: "👮"
        }
      )
  );
}

// ==================== TICKET FORMLARI ====================

function createTicketModal(type) {
  const modalTitles = {
    destek: "Genel Destek Formu",
    sikayet: "Oyuncu Şikâyet Formu",
    tester: "TRIER Tester Başvurusu",
    yetkili: "Yetkili Başvuru Formu"
  };

  const modal = new ModalBuilder()
    .setCustomId(`ticketmodal:${type}`)
    .setTitle(modalTitles[type] || "Ticket Formu");

  if (type === "sikayet") {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("minecraft_username")
          .setLabel("Minecraft kullanıcı adın")
          .setPlaceholder("Örnek: Steve")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reported_player")
          .setLabel("Şikâyet edilen oyuncunun adı")
          .setPlaceholder("Oyuncunun Minecraft kullanıcı adı")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("evidence")
          .setLabel("Kanıtınız var mı?")
          .setPlaceholder("Evet / Hayır — varsa linkini de yaz")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(300)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("complaint_reason")
          .setLabel("Neden şikâyetçisiniz?")
          .setPlaceholder("Hile, küfür, hakaret veya yaşadığın olayı anlat.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1500)
      )
    );
  } else if (type === "destek") {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("minecraft_username")
          .setLabel("Minecraft kullanıcı adın")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("support_subject")
          .setLabel("Konu")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("support_details")
          .setLabel("Nasıl yardımcı olabiliriz?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1500)
      )
    );
  } else if (type === "tester") {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("minecraft_username")
          .setLabel("Minecraft kullanıcı adın")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("trier_meaning")
          .setLabel("TRIER'in nedir?")
          .setPlaceholder("Örnek:LT3 Sword")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("tester_experience")
          .setLabel("Deneyimin ve başvuru sebebin")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1200)
      )
    );
  } else if (type === "yetkili") {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("minecraft_username")
          .setLabel("Minecraft kullanıcı adın")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("requested_role")
          .setLabel("Hangi yetkili rolünü istiyorsun?")
          .setPlaceholder("Örnek: Rehber")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("staff_experience")
          .setLabel("Deneyimin ve başvuru sebebin")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1200)
      )
    );
  }

  return modal;
}

// ==================== TICKET OLUŞTURMA ====================

async function createTicket(interaction, type, answers) {
  const guild = interaction.guild;

  if (!guild) {
    return interaction.reply({
      content: "Bu işlem yalnızca sunucuda kullanılabilir.",
      ephemeral: true
    });
  }

  const existingTicket = Object.values(tickets).find(
    ticket =>
      ticket.guildId === guild.id &&
      ticket.userId === interaction.user.id &&
      !ticket.closed
  );

  if (existingTicket) {
    const existingChannel = guild.channels.cache.get(existingTicket.channelId);

    if (existingChannel) {
      return interaction.reply({
        content: `Zaten açık bir ticket'ın var: ${existingChannel}`,
        ephemeral: true
      });
    }

    delete tickets[existingTicket.channelId];
    saveTickets();
  }

  const typeNames = {
    destek: "Genel Destek",
    sikayet: "Oyuncu Şikâyeti",
    tester: "TRIER Tester Başvurusu",
    yetkili: "Yetkili Başvurusu"
  };

  const categoryId = getTicketCategory(guild.id, type);

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
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  if (STAFF_ROLE_ID && guild.roles.cache.has(STAFF_ROLE_ID)) {
    permissionOverwrites.push({
      id: STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  let channel;

  try {
    channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 80),
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      permissionOverwrites,
      topic: `${typeNames[type]} | Açan: ${interaction.user.tag}`
    });
  } catch (error) {
    console.error("Ticket kanalı oluşturulamadı:", error);

    return interaction.reply({
      content:
        "Ticket kanalı oluşturulamadı. Botun kanal oluşturma ve izinleri yönetme yetkisini kontrol edin.",
      ephemeral: true
    });
  }

  tickets[channel.id] = {
    guildId: guild.id,
    channelId: channel.id,
    userId: interaction.user.id,
    type,
    createdAt: Date.now(),
    closed: false
  };

  saveTickets();

  const detailLines = Object.entries(answers)
    .map(([label, value]) => `**${label}:**\n${value || "Belirtilmedi"}`)
    .join("\n\n");

  const embed = makeEmbed(
    `🎫 ${typeNames[type]}`,
    `**Ticket sahibi:** ${interaction.user}\n` +
    `**Tür:** ${typeNames[type]}\n\n` +
    detailLines
  );

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Ticket'ı Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${interaction.user} ${STAFF_ROLE_ID ? `<@&${STAFF_ROLE_ID}>` : ""}`,
    embeds: [embed],
    components: [closeRow],
    allowedMentions: {
      users: [interaction.user.id],
      roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : []
    }
  });

  await interaction.reply({
    content: `Ticket'ın açıldı: ${channel}`,
    ephemeral: true
  });

  await sendLog(
    guild,
    makeEmbed(
      "🎫 Yeni Ticket",
      `**Kullanıcı:** ${interaction.user.tag}\n` +
      `**Tür:** ${typeNames[type]}\n` +
      `**Kanal:** ${channel}`
    )
  );
}

// ==================== ETKİLEŞİMLER ====================

client.on("interactionCreate", async interaction => {
  try {
    // Ticket menüsü
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {
      const type = interaction.values[0];

      return interaction.showModal(createTicketModal(type));
    }

    // Ticket formları
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ticketmodal:")
    ) {
      const type = interaction.customId.split(":")[1];
      const answers = {};

      if (type === "sikayet") {
        answers["Minecraft kullanıcı adı"] =
          interaction.fields.getTextInputValue("minecraft_username");

        answers["Şikâyet edilen oyuncu"] =
          interaction.fields.getTextInputValue("reported_player");

        answers["Kanıtınız var mı?"] =
          interaction.fields.getTextInputValue("evidence");

        answers["Neden şikâyetçisiniz?"] =
          interaction.fields.getTextInputValue("complaint_reason");
      } else if (type === "destek") {
        answers["Minecraft kullanıcı adı"] =
          interaction.fields.getTextInputValue("minecraft_username");

        answers["Konu"] =
          interaction.fields.getTextInputValue("support_subject");

        answers["Destek açıklaması"] =
          interaction.fields.getTextInputValue("support_details");
      } else if (type === "tester") {
        answers["Minecraft kullanıcı adı"] =
          interaction.fields.getTextInputValue("minecraft_username");

        answers["TRIER'in nedir?"] =
          interaction.fields.getTextInputValue("trier_meaning");

        answers["Deneyim ve başvuru sebebi"] =
          interaction.fields.getTextInputValue("tester_experience");
      } else if (type === "yetkili") {
        answers["Minecraft kullanıcı adı"] =
          interaction.fields.getTextInputValue("minecraft_username");

        answers["İstenen yetkili rolü"] =
          interaction.fields.getTextInputValue("requested_role");

        answers["Deneyim ve başvuru sebebi"] =
          interaction.fields.getTextInputValue("staff_experience");
      } else {
        return interaction.reply({
          content: "Geçersiz ticket türü.",
          ephemeral: true
        });
      }

      return createTicket(interaction, type, answers);
    }

    // Ticket kapatma
    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {
      const ticket = tickets[interaction.channelId];

      if (!ticket) {
        return interaction.reply({
          content: "Bu kanal kayıtlı bir ticket değil.",
          ephemeral: true
        });
      }

      if (
        interaction.user.id !== ticket.userId &&
        !isStaff(interaction.member)
      ) {
        return interaction.reply({
          content: "Bu ticket'ı kapatmak için yetkin yok.",
          ephemeral: true
        });
      }

      await interaction.reply({
        embeds: [
          makeEmbed(
            "🔒 Ticket Kapatılıyor",
            `Ticket, ${interaction.user} tarafından kapatıldı. Kanal 5 saniye içinde silinecek.`
          )
        ]
      });

      ticket.closed = true;
      ticket.closedAt = Date.now();
      saveTickets();

      await sendLog(
        interaction.guild,
        makeEmbed(
          "🔒 Ticket Kapatıldı",
          `**Kanal:** ${interaction.channel}\n` +
          `**Kapatan:** ${interaction.user.tag}\n` +
          `**Ticket sahibi:** <@${ticket.userId}>`
        )
      );

      setTimeout(async () => {
        try {
          await interaction.channel.delete("Ticket kapatıldı.");
          delete tickets[interaction.channelId];
          saveTickets();
        } catch (error) {
          console.error("Ticket silinemedi:", error.message);
        }
      }, 5000);

      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member } = interaction;

    // Genel komutlar
    if (commandName === "help") {
      return interaction.reply({
        embeds: [helpEmbed()],
        ephemeral: true
      });
    }

    if (commandName === "ip") {
      return interaction.reply({
        embeds: [
          makeEmbed(
            "🌐 SVEYDY Minecraft",
            `**Sunucu IP:** \`${SERVER_IP}\`\n\nMinecraft sunucusuna katıl!`
          )
        ]
      });
    }

    if (commandName === "serverinfo") {
      const embed = makeEmbed(
        `📊 ${guild.name}`,
        `**Üye sayısı:** ${guild.memberCount}\n` +
        `**Sunucu sahibi:** <@${guild.ownerId}>\n` +
        `**Sunucu ID:** ${guild.id}\n` +
        `**Oluşturulma:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>`
      );

      if (guild.iconURL()) embed.setThumbnail(guild.iconURL());

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "userinfo") {
      const user = interaction.options.getUser("uye") || interaction.user;
      const target = await guild.members.fetch(user.id).catch(() => null);

      const embed = makeEmbed(
        "👤 Üye Bilgileri",
        `**Kullanıcı:** ${user.tag}\n` +
        `**ID:** ${user.id}\n` +
        `**Hesap oluşturulma:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>\n` +
        `**Sunucuya katılma:** ${
          target?.joinedTimestamp
            ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>`
            : "Bilinmiyor"
        }`
      ).setThumbnail(user.displayAvatarURL());

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "report") {
      const user = interaction.options.getUser("uye");
      const reason = interaction.options.getString("sebep");

      await sendLog(
        guild,
        makeEmbed(
          "🚨 Üye Bildirimi",
          `**Bildirimi yapan:** ${interaction.user.tag}\n` +
          `**Bildirilen üye:** ${user.tag} (${user.id})\n` +
          `**Sebep:** ${reason}`
        )
      );

      return interaction.reply({
        content: "Bildirimin alındı. Yetkililer log kanalını kontrol edebilir.",
        ephemeral: true
      });
    }

    // Yönetim ayarları
    if (commandName === "ticketpanel") {
      return interaction.reply({
        embeds: [ticketPanelEmbed()],
        components: [ticketMenu()]
      });
    }

    if (commandName === "ticketkategori") {
      const type = interaction.options.getString("tur");
      const category = interaction.options.getChannel("kategori");

      if (!settings[guild.id]) settings[guild.id] = {};
      if (!settings[guild.id].ticketCategories) {
        settings[guild.id].ticketCategories = {};
      }

      settings[guild.id].ticketCategories[type] = category.id;
      saveSettings();

      return interaction.reply({
        content: `✅ **${category.name}** kategorisi, **${type}** ticket türü için ayarlandı.`,
        ephemeral: true
      });
    }

    if (commandName === "oto-rol") {
      const role = interaction.options.getRole("rol");

      if (!settings[guild.id]) settings[guild.id] = {};
      settings[guild.id].autoRoleId = role.id;
      saveSettings();

      return interaction.reply({
        content: `✅ Otomatik rol ayarlandı: ${role}`,
        ephemeral: true
      });
    }

    if (commandName === "logkanal") {
      const channel = interaction.options.getChannel("kanal");

      if (!settings[guild.id]) settings[guild.id] = {};
      settings[guild.id].logChannelId = channel.id;
      saveSettings();

      return interaction.reply({
        content: `✅ Log kanalı ayarlandı: ${channel}`,
        ephemeral: true
      });
    }

    // Moderasyon
    if (commandName === "warn") {
      const user = interaction.options.getUser("uye");
      const reason = interaction.options.getString("sebep");

      if (user.bot) {
        return interaction.reply({
          content: "Botlara uyarı veremezsin.",
          ephemeral: true
        });
      }

      if (user.id === interaction.user.id) {
        return interaction.reply({
          content: "Kendine uyarı veremezsin.",
          ephemeral: true
        });
      }

      if (!warnings[guild.id]) warnings[guild.id] = {};
      if (!warnings[guild.id][user.id]) warnings[guild.id][user.id] = [];

      warnings[guild.id][user.id].push({
        reason,
        moderator: interaction.user.id,
        date: new Date().toISOString()
      });

      saveWarnings();

      await sendLog(
        guild,
        makeEmbed(
          "⚠️ Üye Uyarıldı",
          `**Üye:** ${user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`
        )
      );

      return interaction.reply({
        embeds: [
          makeEmbed(
            "⚠️ Uyarı Verildi",
            `**Üye:** ${user.tag}\n**Sebep:** ${reason}`
          )
        ]
      });
    }

    if (commandName === "warnings") {
      const user = interaction.options.getUser("uye");
      const list = warnings[guild.id]?.[user.id] || [];

      const description = list.length
        ? list.map((warning, index) =>
            `**${index + 1}.** ${warning.reason}\n` +
            `Yetkili: <@${warning.moderator}> • ` +
            `${new Date(warning.date).toLocaleString("tr-TR")}`
          ).join("\n\n")
        : "Bu üyenin kayıtlı uyarısı yok.";

      return interaction.reply({
        embeds: [
          makeEmbed(`⚠️ ${user.tag} • Uyarılar`, description)
        ],
        ephemeral: true
      });
    }

    if (commandName === "timeout") {
      const user = interaction.options.getUser("uye");
      const minutes = interaction.options.getInteger("dakika");
      const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";

      const target = await guild.members.fetch(user.id).catch(() => null);

      if (!target) {
        return interaction.reply({
          content: "Üye sunucuda bulunamadı.",
          ephemeral: true
        });
      }

      if (!target.moderatable) {
        return interaction.reply({
          content: "Bu üyeyi susturamıyorum. Botun rolünü ve yetkilerini kontrol et.",
          ephemeral: true
        });
      }

      await target.timeout(minutes * 60 * 1000, reason);

      await sendLog(
        guild,
        makeEmbed(
          "🔇 Üye Susturuldu",
          `**Üye:** ${user.tag}\n**Süre:** ${minutes} dakika\n` +
          `**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`
        )
      );

      return interaction.reply({
        content: `🔇 ${user.tag}, ${minutes} dakika susturuldu.`
      });
    }

    if (commandName === "kick") {
      const user = interaction.options.getUser("uye");
      const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";

      const target = await guild.members.fetch(user.id).catch(() => null);

      if (!target) {
        return interaction.reply({
          content: "Üye sunucuda bulunamadı.",
          ephemeral: true
        });
      }

      if (!target.kickable) {
        return interaction.reply({
          content: "Bu üyeyi atamıyorum. Botun rolünü ve yetkilerini kontrol et.",
          ephemeral: true
        });
      }

      await target.kick(reason);

      await sendLog(
        guild,
        makeEmbed(
          "👢 Üye Atıldı",
          `**Üye:** ${user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`
        )
      );

      return interaction.reply({
        content: `👢 ${user.tag} sunucudan atıldı.`
      });
    }

    if (commandName === "ban") {
      const user = interaction.options.getUser("uye");
      const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";

      const target = await guild.members.fetch(user.id).catch(() => null);

      if (target && !target.bannable) {
        return interaction.reply({
          content: "Bu üyeyi yasaklayamıyorum. Botun rolünü ve yetkilerini kontrol et.",
          ephemeral: true
        });
      }

      await guild.members.ban(user.id, { reason });

      await sendLog(
        guild,
        makeEmbed(
          "🔨 Üye Yasaklandı",
          `**Üye:** ${user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`
        )
      );

      return interaction.reply({
        content: `🔨 ${user.tag} sunucudan yasaklandı.`
      });
    }

    if (commandName === "clear") {
      const amount = interaction.options.getInteger("adet");

      if (!interaction.channel?.bulkDelete) {
        return interaction.reply({
          content: "Bu kanalda mesaj silemiyorum.",
          ephemeral: true
        });
      }

      const deleted = await interaction.channel.bulkDelete(amount, true);

      await interaction.reply({
        content: `🧹 ${deleted.size} mesaj silindi.`,
        ephemeral: true
      });

      await sendLog(
        guild,
        makeEmbed(
          "🧹 Mesajlar Silindi",
          `**Kanal:** ${interaction.channel}\n` +
          `**Silinen mesaj:** ${deleted.size}\n` +
          `**Yetkili:** ${interaction.user.tag}`
        )
      );

      return;
    }

    if (commandName === "lock" || commandName === "unlock") {
      const locked = commandName === "lock";

      await interaction.channel.permissionOverwrites.edit(
        guild.roles.everyone,
        {
          SendMessages: locked ? false : null
        }
      );

      await interaction.reply({
        embeds: [
          makeEmbed(
            locked ? "🔒 Kanal Kilitlendi" : "🔓 Kanal Açıldı",
            locked
              ? "Bu kanalda üyelerin mesaj yazması kapatıldı."
              : "Bu kanalda mesaj yazma izni yeniden açıldı."
          )
        ]
      });

      await sendLog(
        guild,
        makeEmbed(
          locked ? "🔒 Kanal Kilitlendi" : "🔓 Kanal Açıldı",
          `**Kanal:** ${interaction.channel}\n**Yetkili:** ${interaction.user.tag}`
        )
      );

      return;
    }
  } catch (error) {
    console.error("Komut hatası:", error);

    const errorMessage = {
      content: "Bir hata oluştu. Render Logs bölümündeki kırmızı hatayı kontrol et.",
      ephemeral: true
    };

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    }
  }
});

// ==================== PREFIX KOMUTLARI ====================

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();

  if (content.toLowerCase() === "!ip") {
    return message.reply({
      embeds: [
        makeEmbed(
          "🌐 SVEYDY Minecraft",
          `**Sunucu IP:** \`${SERVER_IP}\``
        )
      ]
    });
  }

  if (content.toLowerCase() === "!owner") {
    return message.reply({
      embeds: [
        makeEmbed(
          "👑 Sunucu Sahipleri",
          OWNER_IDS.map(id => `<@${id}>`).join("\n")
        )
      ]
    });
  }

  if (content.toLowerCase() === "!help") {
    return message.reply({ embeds: [helpEmbed()] });
  }
});

// ==================== OTOMATİK ROL ====================

client.on("guildMemberAdd", async member => {
  const roleId = settings[member.guild.id]?.autoRoleId;

  if (roleId) {
    const role = member.guild.roles.cache.get(roleId);

    if (role) {
      await member.roles.add(role).catch(error => {
        console.error("Otomatik rol verilemedi:", error.message);
      });
    }
  }

  await sendLog(
    member.guild,
    makeEmbed(
      "📥 Yeni Üye",
      `**Üye:** ${member.user.tag}\n` +
      `**Sunucu üye sayısı:** ${member.guild.memberCount}`
    )
  );
});

// ==================== ÜYE AYRILDI ====================

client.on("guildMemberRemove", async member => {
  await sendLog(
    member.guild,
    makeEmbed(
      "📤 Üye Ayrıldı",
      `**Üye:** ${member.user.tag}\n` +
      `**Kullanıcı ID:** ${member.id}`
    )
  );
});

// ==================== MESAJ SİLME LOGU ====================

client.on("messageDelete", async message => {
  if (!message.guild || message.author?.bot) return;

  await sendLog(
    message.guild,
    makeEmbed(
      "🗑️ Mesaj Silindi",
      `**Kanal:** ${message.channel}\n` +
      `**Kullanıcı:** ${message.author?.tag || "Bilinmiyor"}\n` +
      `**Mesaj:** ${(message.content || "Mesaj içeriği alınamadı").slice(0, 1500)}`
    )
  );
});

// ==================== MESAJ DÜZENLEME LOGU ====================

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;

  if (oldMessage.partial || newMessage.partial) return;
  if (oldMessage.content === newMessage.content) return;

  await sendLog(
    newMessage.guild,
    makeEmbed(
      "✏️ Mesaj Düzenlendi",
      `**Kanal:** ${newMessage.channel}\n` +
      `**Kullanıcı:** ${newMessage.author.tag}\n\n` +
      `**Eski mesaj:**\n${(oldMessage.content || "Boş").slice(0, 700)}\n\n` +
      `**Yeni mesaj:**\n${(newMessage.content || "Boş").slice(0, 700)}`
    )
  );
});

// ==================== HATA YÖNETİMİ ====================

process.on("unhandledRejection", error => {
  console.error("Yakalanmamış Promise hatası:", error);
});

process.on("uncaughtException", error => {
  console.error("Yakalanmamış hata:", error);
});

// ==================== GİRİŞ ====================

client.login(TOKEN);
