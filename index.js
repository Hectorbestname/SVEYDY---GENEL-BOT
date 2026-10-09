
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

// ========================================
// SVEYDY GENEL BOT | Node.js 20+
// ========================================

const TOKEN = process.env.DISCORD_TOKEN?.trim();
const CLIENT_ID = process.env.CLIENT_ID?.trim();
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID?.trim();
const IP = "sveydypvp.play.hosting";

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN ve CLIENT_ID Render ortam değişkenlerinde ayarlanmalı.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

// JSON kayıtları. Render yeniden başlatmalarında kalıcılık için
// Render Persistent Disk veya harici veritabanı gerekir.
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

function readData(file, fallback) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), "utf8")
    );
  } catch {
    return fallback;
  }
}

function saveData(file, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, file),
    JSON.stringify(data, null, 2)
  );
}

let settings = readData("settings.json", {});
let warnings = readData("warnings.json", {});
let tickets = readData("tickets.json", {});

function makeEmbed(title, description, color = 0x7c3aed) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "SVEYDY GENEL BOT" })
    .setTimestamp();
}

function isStaff(member) {
  if (!member) return false;

  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    Boolean(
      STAFF_ROLE_ID &&
      member.roles.cache.has(STAFF_ROLE_ID)
    )
  );
}

async function sendLog(guild, title, description, color = 0x7c3aed) {
  const channelId =
    settings[guild.id]?.logChannel ||
    process.env.LOG_CHANNEL_ID;

  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  try {
    await channel.send({
      embeds: [makeEmbed(title, description, color)]
    });
  } catch (error) {
    console.error("Log hatası:", error.message);
  }
}

function makeInput(id, label, placeholder, style = TextInputStyle.Short) {
  return new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setStyle(style)
    .setRequired(true)
    .setMaxLength(style === TextInputStyle.Paragraph ? 1000 : 100);
}

function staffPing() {
  return STAFF_ROLE_ID ? `<@&${STAFF_ROLE_ID}>` : "";
}

// ========================================
// SLASH KOMUTLARI
// ========================================

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Botun komutlarını gösterir."),

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("Minecraft sunucu IP'sini gösterir."),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Discord sunucusu bilgilerini gösterir."),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Genel Destek ve Şikâyet ticket panelini gönderir.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("basvurupanel")
    .setDescription("Genel Destek ve Tester başvuru panelini gönderir.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("logkanal")
    .setDescription("Log kanalını ayarlar.")
    .addChannelOption(o =>
      o.setName("kanal")
        .setDescription("Log kanalı")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("basvurukanal")
    .setDescription("Başvuruların gönderileceği kanalı ayarlar.")
    .addChannelOption(o =>
      o.setName("kanal")
        .setDescription("Başvuru sonuç kanalı")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Bir üyeye uyarı verir.")
    .addUserOption(o =>
      o.setName("uye").setDescription("Üye").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("neden").setDescription("Uyarı nedeni").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Bir üyenin uyarılarını gösterir.")
    .addUserOption(o =>
      o.setName("uye").setDescription("Üye").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Bir üyeyi geçici olarak susturur.")
    .addUserOption(o =>
      o.setName("uye").setDescription("Üye").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("dakika")
        .setDescription("Süre (dakika)")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("neden").setDescription("Sebep").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Bir üyeyi sunucudan atar.")
    .addUserOption(o =>
      o.setName("uye").setDescription("Üye").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("neden").setDescription("Sebep").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bir üyeyi yasaklar.")
    .addUserOption(o =>
      o.setName("uye").setDescription("Üye").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("neden").setDescription("Sebep").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Mesajları topluca siler.")
    .addIntegerOption(o =>
      o.setName("adet")
        .setDescription("1-100 arası mesaj")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Mevcut kanalı kilitler.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Mevcut kanalın kilidini açar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Üye bilgilerini gösterir.")
    .addUserOption(o =>
      o.setName("uye").setDescription("Üye").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Bir oyuncuyu yetkililere bildirir.")
    .addUserOption(o =>
      o.setName("uye").setDescription("Şikâyet edilen oyuncu").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("neden").setDescription("Şikâyet nedeni").setRequired(true)
    )
].map(command => command.toJSON());

// ========================================
// BOT BAŞLATMA VE KOMUT KAYDI
// ========================================

client.once("ready", async () => {
  console.log(`SVEYDY GENEL BOT aktif: ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("Slash komutları kaydedildi.");
  } catch (error) {
    console.error("Komut kayıt hatası:", error);
  }
});

// ========================================
// !ip
// ========================================

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  if (message.content.trim().toLowerCase() === "!ip") {
    await message.reply({
      embeds: [
        makeEmbed(
          "⚔️ SVEYDY PVP",
          `**Minecraft sunucu IP'si**\n\`\`\`${IP}\`\`\`\nJava Edition üzerinden bağlanabilirsin.`
        )
      ]
    });
  }
});

// ========================================
// TICKET PANELİ
// Kategoriler: Genel Destek / Şikâyet
// ========================================

function ticketPanelPayload() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("Ticket kategorisini seç...")
    .addOptions(
      {
        label: "Genel Destek",
        description: "Yardım ve genel sorular",
        value: "general",
        emoji: "💬"
      },
      {
        label: "Şikâyet / Oyuncu",
        description: "Oyuncu şikâyeti bildir",
        value: "complaint",
        emoji: "🛡️"
      }
    );

  return {
    embeds: [
      makeEmbed(
        "🎫 SVEYDY | Destek Merkezi",
        "**💬 Genel Destek**\nSorunlarını ve sorularını ilet.\n\n" +
        "**🛡️ Şikâyet / Oyuncu**\nKural ihlali yapan oyuncuları bildir.\n\n" +
        "Her ticket'ta Minecraft kullanıcı adın sorulur."
      )
    ],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

// ========================================
// BAŞVURU PANELİ
// Kategoriler: Genel Destek / Tester
// ========================================

function applicationPanelPayload() {
  return {
    embeds: [
      makeEmbed(
        "📋 SVEYDY | Başvuru Merkezi",
        "**💬 Genel Destek**\nYardım talebi oluştur.\n\n" +
        "**🧪 Tester Olmak İstiyorum**\nTest ekibine katılmak için başvur.\n\n" +
        "Minecraft kullanıcı adın her başvuruda istenir. " +
        "“TRIER'in nedir?” sorusu yalnızca tester başvurusunda sorulur."
      )
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("application_general")
          .setLabel("Genel Destek")
          .setEmoji("💬")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("application_tester")
          .setLabel("Tester Olmak İstiyorum")
          .setEmoji("🧪")
          .setStyle(ButtonStyle.Success)
      )
    ]
  };
}

async function getCategory(guild, name) {
  let category = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      channel.name === name
  );

  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory
    });
  }

  return category;
}

async function openTicketModal(interaction, type) {
  const modal = new ModalBuilder()
    .setCustomId(`ticketmodal_${type}`)
    .setTitle(type === "general" ? "Genel Destek" : "Şikâyet / Oyuncu");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      makeInput("mc_name", "Minecraft kullanıcı adın", "Minecraft adını yaz")
    ),
    new ActionRowBuilder().addComponents(
      makeInput(
        "details",
        type === "general" ? "Nasıl yardımcı olabiliriz?" : "Şikâyet nedeni",
        "Açıklamanı yaz...",
        TextInputStyle.Paragraph
      )
    )
  );

  await interaction.showModal(modal);
}

async function createTicket(interaction, type, mcName, details) {
  const guild = interaction.guild;
  const user = interaction.user;
  const key = `${guild.id}:${user.id}`;

  const oldTicket = tickets[key];

  if (oldTicket && guild.channels.cache.has(oldTicket.channelId)) {
    return interaction.reply({
      content: `Zaten açık bir ticket'ın var: <#${oldTicket.channelId}>`,
      ephemeral: true
    });
  }

  delete tickets[key];

  const categoryName = type === "general"
    ? "SVEYDY • GENEL DESTEK"
    : "SVEYDY • OYUNCU ŞİKÂYETLERİ";

  const category = await getCategory(guild, categoryName);

  const safeName = user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 18) || "uye";

  const permissions = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id,
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
    permissions.push({
      id: STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const channel = await guild.channels.create({
    name: `${type === "general" ? "destek" : "sikayet"}-${safeName}`,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: permissions,
    topic: `SVEYDY_TICKET owner=${user.id} type=${type} mc=${mcName}`
  });

  tickets[key] = {
    channelId: channel.id,
    ownerId: user.id,
    type,
    mcName
  };
  saveData("tickets.json", tickets);

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Ticket Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${user} ${staffPing()}`,
    embeds: [
      makeEmbed(
        type === "general" ? "💬 Genel Destek" : "🛡️ Şikâyet / Oyuncu",
        `**Başvuran:** ${user}\n` +
        `**Minecraft kullanıcı adı:** \`${mcName}\`\n\n` +
        `**Açıklama:**\n${details}`
      )
    ],
    components: [closeRow],
    allowedMentions: {
      users: [user.id],
      roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : []
    }
  });

  await interaction.reply({
    content: `Ticket oluşturuldu: ${channel}`,
    ephemeral: true
  });

  await sendLog(
    guild,
    "🎫 Ticket Açıldı",
    `Kullanıcı: ${user.tag}\nKategori: ${type}\nKanal: ${channel}`
  );
}

// ========================================
// BAŞVURU MODALI
// Genel Destek: MC kullanıcı adı + açıklama
// Tester: MC kullanıcı adı + TRIER + açıklama
// ========================================

async function openApplicationModal(interaction, type) {
  const tester = type === "tester";

  const modal = new ModalBuilder()
    .setCustomId(`applicationmodal_${type}`)
    .setTitle(tester ? "Tester Başvurusu" : "Genel Destek");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      makeInput("mc_name", "Minecraft kullanıcı adın", "Minecraft adını yaz")
    )
  );

  if (tester) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        makeInput("trier", "TRIER'in nedir?", "Cevabını yaz")
      )
    );
  }

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      makeInput(
        "details",
        tester ? "Neden tester olmak istiyorsun?" : "Nasıl yardımcı olabiliriz?",
        "Açıklamanı yaz...",
        TextInputStyle.Paragraph
      )
    )
  );

  await interaction.showModal(modal);
}

async function submitApplication(interaction, type) {
  const tester = type === "tester";
  const mcName = interaction.fields.getTextInputValue("mc_name");
  const details = interaction.fields.getTextInputValue("details");
  const trier = tester
    ? interaction.fields.getTextInputValue("trier")
    : null;

  const channelId =
    settings[interaction.guild.id]?.applicationChannel ||
    process.env.APPLICATION_CHANNEL_ID;

  const channel = channelId
    ? interaction.guild.channels.cache.get(channelId)
    : null;

  if (!channel?.isTextBased()) {
    return interaction.reply({
      content: "Başvuru kanalı ayarlanmamış. Yetkili /basvurukanal komutuyla ayarlamalı.",
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`application_accept_${interaction.user.id}`)
      .setLabel("Kabul Et")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`application_reject_${interaction.user.id}`)
      .setLabel("Reddet")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  const description =
    `**Başvuran:** ${interaction.user} (\`${interaction.user.tag}\`)\n` +
    `**Minecraft kullanıcı adı:** \`${mcName}\`\n` +
    (tester ? `**TRIER'in nedir?:** ${trier}\n` : "") +
    `\n**Açıklama:**\n${details}`;

  const posted = await channel.send({
    content: staffPing(),
    embeds: [
      makeEmbed(
        tester ? "🧪 Tester Başvurusu" : "💬 Genel Destek Başvurusu",
        description
      )
    ],
    components: [row],
    allowedMentions: {
      roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : []
    }
  });

  await interaction.reply({
    content: "Başvurun başarıyla gönderildi!",
    ephemeral: true
  });

  await sendLog(
    interaction.guild,
    "📝 Yeni Başvuru",
    `${interaction.user.tag} tarafından ${tester ? "Tester" : "Genel Destek"} başvurusu gönderildi.\nMesaj: ${posted.url}`
  );
}

// ========================================
// TÜM ETKİLEŞİMLER
// ========================================

client.on("interactionCreate", async interaction => {
  try {
    // Slash komutları
    if (interaction.isChatInputCommand()) {
      const { commandName, guild, member, options } = interaction;

      if (commandName === "help") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              "📚 SVEYDY GENEL BOT",
              "**Ticket:** `/ticketpanel`\n" +
              "**Başvurular:** `/basvurupanel`\n" +
              "**IP:** `/ip` veya `!ip`\n" +
              "**Bilgi:** `/serverinfo`, `/userinfo`\n" +
              "**Moderasyon:** `/warn`, `/warnings`, `/timeout`, `/kick`, `/ban`, `/clear`, `/lock`, `/unlock`\n" +
              "**Ayarlar:** `/logkanal`, `/basvurukanal`\n\n" +
              "Ekonomi ve seviye sistemi bulunmaz."
            )
          ],
          ephemeral: true
        });
      }

      if (commandName === "ip") {
        return interaction.reply({
          embeds: [makeEmbed("⚔️ SVEYDY PVP", `Sunucu IP'si:\n\`\`\`${IP}\`\`\``)]
        });
      }

      if (commandName === "serverinfo") {
        return interaction.reply({
          embeds: [
            makeEmbed(
              `📊 ${guild.name}`,
              `**Üye sayısı:** ${guild.memberCount}\n` +
              `**Sunucu ID:** ${guild.id}\n` +
              `**Oluşturulma:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`
            )
          ]
        });
      }

      if (commandName === "ticketpanel") {
        return interaction.reply({
          ...ticketPanelPayload(),
          ephemeral: false
        });
      }

      if (commandName === "basvurupanel") {
        return interaction.reply({
          ...applicationPanelPayload(),
          ephemeral: false
        });
      }

      if (commandName === "logkanal") {
        const channel = options.getChannel("kanal");
        settings[guild.id] ??= {};
        settings[guild.id].logChannel = channel.id;
        saveData("settings.json", settings);

        return interaction.reply({
          content: `Log kanalı ayarlandı: ${channel}`,
          ephemeral: true
        });
      }

      if (commandName === "basvurukanal") {
        const channel = options.getChannel("kanal");
        settings[guild.id] ??= {};
        settings[guild.id].applicationChannel = channel.id;
        saveData("settings.json", settings);

        return interaction.reply({
          content: `Başvuru kanalı ayarlandı: ${channel}`,
          ephemeral: true
        });
      }

      if (commandName === "userinfo") {
        const user = options.getUser("uye") || interaction.user;
        const targetMember = await guild.members.fetch(user.id).catch(() => null);

        return interaction.reply({
          embeds: [
            makeEmbed(
              "👤 Kullanıcı Bilgileri",
              `**Kullanıcı:** ${user.tag}\n` +
              `**ID:** ${user.id}\n` +
              `**Hesap oluşturulma:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>\n` +
              (targetMember
                ? `**Sunucuya katılım:** <t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`
                : "")
            ).setThumbnail(user.displayAvatarURL())
          ]
        });
      }

      if (commandName === "warn") {
        const user = options.getUser("uye");
        const reason = options.getString("neden");
        const key = `${guild.id}:${user.id}`;

        warnings[key] ??= [];
        warnings[key].push({
          reason,
          moderator: interaction.user.tag,
          date: new Date().toISOString()
        });
        saveData("warnings.json", warnings);

        await sendLog(
          guild,
          "⚠️ Üye Uyarıldı",
          `**Üye:** ${user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`,
          0xf59e0b
        );

        return interaction.reply({
          content: `${user.tag} uyarıldı. Sebep: ${reason}`
        });
      }

      if (commandName === "warnings") {
        const user = options.getUser("uye");
        const list = warnings[`${guild.id}:${user.id}`] || [];

        return interaction.reply({
          embeds: [
            makeEmbed(
              `⚠️ ${user.tag} — Uyarılar`,
              list.length
                ? list.map((w, i) =>
                    `**${i + 1}.** ${w.reason}\nYetkili: ${w.moderator} | ${w.date}`
                  ).join("\n\n").slice(0, 4000)
                : "Bu üyenin kayıtlı uyarısı yok."
            )
          ],
          ephemeral: true
        });
      }

      if (commandName === "timeout") {
        const user = options.getUser("uye");
        const minutes = options.getInteger("dakika");
        const reason = options.getString("neden") || "Sebep belirtilmedi.";
        const target = await guild.members.fetch(user.id);

        if (!target.moderatable) {
          return interaction.reply({
            content: "Bu üyeyi susturamıyorum. Botun rolünü ve izinlerini kontrol et.",
            ephemeral: true
          });
        }

        await target.timeout(minutes * 60 * 1000, reason);

        await sendLog(
          guild,
          "🔇 Timeout",
          `**Üye:** ${user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Süre:** ${minutes} dakika\n**Sebep:** ${reason}`
        );

        return interaction.reply(`${user.tag} ${minutes} dakika susturuldu.`);
      }

      if (commandName === "kick" || commandName === "ban") {
        const user = options.getUser("uye");
        const reason = options.getString("neden") || "Sebep belirtilmedi.";
        const target = await guild.members.fetch(user.id).catch(() => null);

        if (!target) {
          return interaction.reply({
            content: "Üye sunucuda bulunamadı.",
            ephemeral: true
          });
        }

        if (target.id === interaction.user.id || target.id === client.user.id) {
          return interaction.reply({
            content: "Bu kullanıcı üzerinde bu işlemi yapamazsın.",
            ephemeral: true
          });
        }

        if (!target.moderatable) {
          return interaction.reply({
            content: "Bu üyeye işlem uygulayamıyorum. Rol sırasını ve bot izinlerini kontrol et.",
            ephemeral: true
          });
        }

        if (commandName === "kick") {
          if (!target.kickable) {
            return interaction.reply({
              content: "Bu üyeyi atamıyorum. Botun rol sırasını kontrol et.",
              ephemeral: true
            });
          }
          await target.kick(reason);
        } else {
          if (!target.bannable) {
            return interaction.reply({
              content: "Bu üyeyi yasaklayamıyorum. Botun rol sırasını kontrol et.",
              ephemeral: true
            });
          }
          await target.ban({ reason });
        }

        await sendLog(
          guild,
          commandName === "kick" ? "👢 Üye Atıldı" : "🔨 Üye Yasaklandı",
          `**Üye:** ${user.tag}\n**Yetkili:** ${interaction.user.tag}\n**Sebep:** ${reason}`
        );

        return interaction.reply(`${user.tag} için ${commandName} işlemi tamamlandı.`);
      }

      if (commandName === "clear") {
        const amount = options.getInteger("adet");

        if (!interaction.channel?.bulkDelete) {
          return interaction.reply({
            content: "Bu kanalda mesaj temizlenemiyor.",
            ephemeral: true
          });
        }

        const deleted = await interaction.channel.bulkDelete(amount, true);

        await interaction.reply({
          content: `${deleted.size} mesaj silindi. Discord 14 günden eski mesajları toplu silemez.`,
          ephemeral: true
        });

        await sendLog(
          guild,
          "🧹 Mesajlar Temizlendi",
          `**Yetkili:** ${interaction.user.tag}\n**Kanal:** ${interaction.channel}\n**Silinen:** ${deleted.size}`
        );
        return;
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
              `${interaction.channel} ${locked ? "mesajlara kapatıldı" : "yeniden açıldı"}.`
            )
          ]
        });
      }

      if (commandName === "report") {
        const user = options.getUser("uye");
        const reason = options.getString("neden");

        await sendLog(
          guild,
          "🚨 Oyuncu Şikâyeti",
          `**Şikâyet eden:** ${interaction.user.tag}\n**Şikâyet edilen:** ${user.tag}\n**Sebep:** ${reason}`,
          0xef4444
        );

        return interaction.reply({
          content: "Şikâyetin yetkililere iletildi.",
          ephemeral: true
        });
      }
    }

    // Ticket kategori menüsü
    if (interaction.isStringSelectMenu() &&
        interaction.customId === "ticket_category") {
      return openTicketModal(interaction, interaction.values[0]);
    }

    // Başvuru butonları
    if (interaction.isButton() &&
        interaction.customId.startsWith("application_")) {
      const id = interaction.customId;

      if (id === "application_general") {
        return openApplicationModal(interaction, "general");
      }

      if (id === "application_tester") {
        return openApplicationModal(interaction, "tester");
      }

      if (id.startsWith("application_accept_") ||
          id.startsWith("application_reject_")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Bu işlem için yetkili olmalısın.",
            ephemeral: true
          });
        }

        const accepted = id.startsWith("application_accept_");
        const applicantId = id.split("_").pop();
        const applicant = await client.users.fetch(applicantId).catch(() => null);

        await interaction.message.edit({
          embeds: [
            ...interaction.message.embeds.map(e => {
              const updated = EmbedBuilder.from(e);
              updated.addFields({
                name: "Başvuru Sonucu",
                value: `${accepted ? "✅ Kabul edildi" : "❌ Reddedildi"}\nYetkili: ${interaction.user.tag}`
              });
              return updated;
            })
          ],
          components: []
        });

        if (applicant) {
          await applicant.send(
            `SVEYDY başvurun ${accepted ? "kabul edildi ✅" : "reddedildi ❌"}.`
          ).catch(() => {});
        }

        await sendLog(
          interaction.guild,
          "📋 Başvuru Sonuçlandı",
          `Başvuran ID: ${applicantId}\nSonuç: ${accepted ? "Kabul" : "Ret"}\nYetkili: ${interaction.user.tag}`
        );

        return interaction.reply({
          content: `Başvuru ${accepted ? "kabul edildi" : "reddedildi"}.`,
          ephemeral: true
        });
      }
    }

    // Ticket kapatma
    if (interaction.isButton() && interaction.customId === "ticket_close") {
      const channel = interaction.channel;
      const topic = channel.topic || "";
      const ownerMatch = topic.match(/owner=(\d+)/);
      const ownerId = ownerMatch?.[1];

      if (!isStaff(interaction.member) && interaction.user.id !== ownerId) {
        return interaction.reply({
          content: "Bu ticket'ı kapatma yetkin yok.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "Ticket kapatılıyor...",
        ephemeral: true
      });

      for (const [key, ticket] of Object.entries(tickets)) {
        if (ticket.channelId === channel.id) {
          delete tickets[key];
        }
      }
      saveData("tickets.json", tickets);

      await channel.permissionOverwrites.edit(
        ownerId,
        { SendMessages: false }
      ).catch(() => {});

      await channel.setName(`kapali-${channel.name}`.slice(0, 100)).catch(() => {});

      await channel.send({
        embeds: [
          makeEmbed(
            "🔒 Ticket Kapatıldı",
            `Kapatan: ${interaction.user}\nBu kanal arşiv olarak tutuluyor.`
          )
        ],
        components: []
      }).catch(() => {});

      await sendLog(
        interaction.guild,
        "🔒 Ticket Kapatıldı",
        `Kanal: ${channel.name}\nKapatan: ${interaction.user.tag}`
      );

      return;
    }

    // Ticket modal gönderimi
    if (interaction.isModalSubmit() &&
        interaction.customId.startsWith("ticketmodal_")) {
      const type = interaction.customId.replace("ticketmodal_", "");
      const mcName = interaction.fields.getTextInputValue("mc_name");
      const details = interaction.fields.getTextInputValue("details");

      return createTicket(interaction, type, mcName, details);
    }

    // Başvuru modal gönderimi
    if (interaction.isModalSubmit() &&
        interaction.customId.startsWith("applicationmodal_")) {
      const type = interaction.customId.replace("applicationmodal_", "");
      return submitApplication(interaction, type);
    }
  } catch (error) {
    console.error("Interaction hatası:", error);

    const response = {
      content: "İşlem sırasında hata oluştu. Bot izinlerini ve Render loglarını kontrol et.",
      ephemeral: true
    };

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply(response).catch(() => {});
    }
  }
});

// ========================================
// HATA YAKALAMA
// ========================================

process.on("unhandledRejection", error => {
  console.error("İşlenmeyen Promise hatası:", error);
});

client.login(TOKEN);
