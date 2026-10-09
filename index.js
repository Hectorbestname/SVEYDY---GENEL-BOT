
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PREFIX = "!";

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN ve CLIENT_ID Render Environment Variables bölümüne eklenmeli.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

const COLORS = {
  red: 0xe53935,
  green: 0x22c55e,
  white: 0xffffff
};

// Basit bellekte tutulan veriler.
// Bot yeniden başlatıldığında bunlar sıfırlanır.
const warnings = new Map();
const xpData = new Map();
const coins = new Map();
const afk = new Map();
const tickets = new Set();
const maintenance = new Set();
const giveaways = new Map();

const key = (guildId, userId) => `${guildId}:${userId}`;

function embed(title, description, color = COLORS.green) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function log(guild, message) {
  const channel = guild.channels.cache.find(
    c => c.name === "sveydy-log" && c.isTextBased()
  );
  if (channel) {
    await channel.send({ embeds: [embed("📋 Sunucu Kaydı", message)] }).catch(() => {});
  }
}

function isStaff(member) {
  return member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.Administrator);
}

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Botun gecikmesini gösterir"),

  new SlashCommandBuilder()
    .setName("kurulum")
    .setDescription("Temel SVEYDY kanallarını oluşturur")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ticket-kur")
    .setDescription("Ticket panelini gönderir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("uyar")
    .setDescription("Bir üyeye uyarı verir")
    .addUserOption(o => o.setName("uye").setDescription("Üye").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("uyarilar")
    .setDescription("Üyenin uyarı sayısını gösterir")
    .addUserOption(o => o.setName("uye").setDescription("Üye").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Üyeyi susturur")
    .addUserOption(o => o.setName("uye").setDescription("Üye").setRequired(true))
    .addIntegerOption(o => o.setName("dakika").setDescription("Dakika").setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("at")
    .setDescription("Üyeyi sunucudan atar")
    .addUserOption(o => o.setName("uye").setDescription("Üye").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Üyeyi yasaklar")
    .addUserOption(o => o.setName("uye").setDescription("Üye").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("temizle")
    .setDescription("Mesajları temizler")
    .addIntegerOption(o => o.setName("adet").setDescription("1-100 arası").setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("kayit")
    .setDescription("Üyeyi kayıt eder")
    .addUserOption(o => o.setName("uye").setDescription("Üye").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("gunluk")
    .setDescription("Günlük coin ödülünü al"),

  new SlashCommandBuilder()
    .setName("coin")
    .setDescription("Coin bakiyeni göster"),

  new SlashCommandBuilder()
    .setName("calis")
    .setDescription("Çalışıp coin kazan"),

  new SlashCommandBuilder()
    .setName("seviye")
    .setDescription("Seviye ve XP durumunu göster"),

  new SlashCommandBuilder()
    .setName("afk")
    .setDescription("AFK durumunu ayarla")
    .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(false)),

  new SlashCommandBuilder()
    .setName("öneri")
    .setDescription("Sunucu için öneri gönder")
    .addStringOption(o => o.setName("metin").setDescription("Önerin").setRequired(true)),

  new SlashCommandBuilder()
    .setName("duyuru")
    .setDescription("Duyuru gönderir")
    .addStringOption(o => o.setName("metin").setDescription("Duyuru").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("bakim")
    .setDescription("Bot bakım modunu açar veya kapatır")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("cekilis")
    .setDescription("Basit bir çekiliş başlatır")
    .addIntegerOption(o => o.setName("dakika").setDescription("Süre (dakika)").setMinValue(1).setRequired(true))
    .addStringOption(o => o.setName("odul").setDescription("Ödül").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());

client.once("ready", async () => {
  console.log(`SVEYDY GENEL BOT aktif: ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Slash komutları kaydedildi.");
  } catch (error) {
    console.error("Komut kayıt hatası:", error);
  }

  client.user.setActivity("SVEYDY | /ping");
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isButton()) {
      const guild = interaction.guild;
      if (!guild) return;

      if (interaction.customId === "ticket_create") {
        const existing = guild.channels.cache.find(
          c => c.name === `ticket-${interaction.user.id}`.toLowerCase()
        );

        if (existing) {
          return interaction.reply({
            content: `Zaten açık bir ticket'ın var: ${existing}`,
            ephemeral: true
          });
        }

        const channel = await guild.channels.create({
          name: `ticket-${interaction.user.id}`.toLowerCase(),
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Ticket Kapat")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: `${interaction.user} Destek talebin açıldı. Yetkililer burada yardımcı olacak.`,
          components: [row]
        });

        return interaction.reply({
          content: `Ticket açıldı: ${channel}`,
          ephemeral: true
        });
      }

      if (interaction.customId === "ticket_close") {
        const ownerId = interaction.channel.name.replace("ticket-", "");
        if (interaction.user.id !== ownerId && !isStaff(interaction.member)) {
          return interaction.reply({
            content: "Bu ticket'ı yalnızca sahibi veya yetkili kapatabilir.",
            ephemeral: true
          });
        }

        await interaction.reply("Ticket 5 saniye içinde kapatılacak.");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member, user } = interaction;
    if (!guild) {
      return interaction.reply({ content: "Bu komut sunucuda kullanılabilir.", ephemeral: true });
    }

    if (maintenance.has(guild.id) && !member.permissions.has(PermissionFlagsBits.Administrator) &&
        commandName !== "ping") {
      return interaction.reply({ content: "Bot şu anda bakım modunda.", ephemeral: true });
    }

    if (commandName === "ping") {
      return interaction.reply(`🏓 Pong! ${client.ws.ping} ms`);
    }

    if (commandName === "kurulum") {
      await interaction.deferReply({ ephemeral: true });

      const names = ["sveydy-log", "öneriler", "duyurular"];
      const created = [];

      for (const name of names) {
        let channel = guild.channels.cache.find(c => c.name === name);
        if (!channel) {
          channel = await guild.channels.create({
            name,
            type: ChannelType.GuildText
          });
          created.push(name);
        }
      }

      await log(guild, `${user.tag} temel kurulum komutunu kullandı.`);
      return interaction.editReply(
        created.length
          ? `Kurulum tamamlandı. Oluşturulan kanallar: ${created.join(", ")}`
          : "Temel kanallar zaten mevcut."
      );
    }

    if (commandName === "ticket-kur") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_create")
          .setLabel("🎫 Destek Talebi Aç")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        embeds: [
          embed("🎫 SVEYDY DESTEK", "Destek almak için aşağıdaki butona tıkla.", COLORS.white)
        ],
        components: [row]
      });
    }

    if (commandName === "uyar") {
      const target = interaction.options.getUser("uye");
      const reason = interaction.options.getString("sebep");
      const id = key(guild.id, target.id);
      warnings.set(id, (warnings.get(id) || 0) + 1);
      await log(guild, `${target.tag} uyarıldı. Sebep: ${reason}`);
      return interaction.reply(`${target} uyarıldı. Toplam uyarı: ${warnings.get(id)}. Sebep: ${reason}`);
    }

    if (commandName === "uyarilar") {
      const target = interaction.options.getUser("uye");
      return interaction.reply({
        content: `${target.tag} uyarı sayısı: ${warnings.get(key(guild.id, target.id)) || 0}`,
        ephemeral: true
      });
    }

    if (commandName === "timeout") {
      const target = interaction.options.getMember("uye");
      const minutes = interaction.options.getInteger("dakika");
      const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";

      if (!target || !target.moderatable) {
        return interaction.reply({ content: "Bu üyeye timeout uygulayamıyorum. Rol sırasını kontrol et.", ephemeral: true });
      }

      await target.timeout(minutes * 60 * 1000, reason);
      await log(guild, `${target.user.tag} ${minutes} dakika susturuldu. Sebep: ${reason}`);
      return interaction.reply(`${target.user.tag}, ${minutes} dakika susturuldu.`);
    }

    if (commandName === "at") {
      const target = interaction.options.getMember("uye");
      const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
      if (!target || !target.kickable) {
        return interaction.reply({ content: "Bu üyeyi atamıyorum. Rol sırasını kontrol et.", ephemeral: true });
      }
      await target.kick(reason);
      await log(guild, `${target.user.tag} atıldı. Sebep: ${reason}`);
      return interaction.reply(`${target.user.tag} sunucudan atıldı.`);
    }

    if (commandName === "ban") {
      const target = interaction.options.getMember("uye");
      const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
      if (!target || !target.bannable) {
        return interaction.reply({ content: "Bu üyeyi yasaklayamıyorum. Rol sırasını kontrol et.", ephemeral: true });
      }
      await target.ban({ reason });
      await log(guild, `${target.user.tag} yasaklandı. Sebep: ${reason}`);
      return interaction.reply(`${target.user.tag} sunucudan yasaklandı.`);
    }

    if (commandName === "temizle") {
      const amount = interaction.options.getInteger("adet");
      const deleted = await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({
        content: `${deleted.size} mesaj silindi.`,
        ephemeral: true
      });
    }

    if (commandName === "kayit") {
      const target = interaction.options.getMember("uye");
      if (!target) return interaction.reply({ content: "Üye bulunamadı.", ephemeral: true });

      // İsteğe bağlı kayıt rolünü rol ID'si ile yapılandır.
      const roleId = process.env.MEMBER_ROLE_ID;
      if (roleId) {
        const role = guild.roles.cache.get(roleId);
        if (role) await target.roles.add(role);
      }

      await log(guild, `${target.user.tag} ${user.tag} tarafından kayıt edildi.`);
      return interaction.reply(`${target.user.tag} kayıt işlemi tamamlandı.`);
    }

    if (commandName === "gunluk") {
      const id = key(guild.id, user.id);
      const now = Date.now();
      const last = coins.get(`${id}:daily`) || 0;
      if (now - last < 24 * 60 * 60 * 1000) {
        return interaction.reply({ content: "Günlük ödülünü zaten aldın. 24 saat sonra tekrar dene.", ephemeral: true });
      }

      coins.set(`${id}:daily`, now);
      coins.set(id, (coins.get(id) || 0) + 250);
      return interaction.reply("🎁 Günlük ödülün: **250 coin**!");
    }

    if (commandName === "coin") {
      const id = key(guild.id, user.id);
      return interaction.reply(`💰 Bakiyen: **${coins.get(id) || 0} coin**`);
    }

    if (commandName === "calis") {
      const id = key(guild.id, user.id);
      const amount = Math.floor(Math.random() * 101) + 50;
      coins.set(id, (coins.get(id) || 0) + amount);
      return interaction.reply(`💼 Çalıştın ve **${amount} coin** kazandın!`);
    }

    if (commandName === "seviye") {
      const data = xpData.get(key(guild.id, user.id)) || { xp: 0, level: 0 };
      return interaction.reply(`⭐ Seviyen: **${data.level}** | XP: **${data.xp}**`);
    }

    if (commandName === "afk") {
      const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";
      afk.set(key(guild.id, user.id), reason);
      return interaction.reply(`💤 AFK durumun ayarlandı. Sebep: ${reason}`);
    }

    if (commandName === "öneri") {
      const suggestion = interaction.options.getString("metin");
      const channel = guild.channels.cache.find(c => c.name === "öneriler" && c.isTextBased());
      if (!channel) return interaction.reply({ content: "Önce /kurulum komutunu kullan.", ephemeral: true });

      const msg = await channel.send({
        embeds: [embed("💡 Yeni Öneri", `**Gönderen:** ${user}\n**Öneri:** ${suggestion}`)]
      });
      await msg.react("👍");
      await msg.react("👎");
      return interaction.reply({ content: "Önerin gönderildi.", ephemeral: true });
    }

    if (commandName === "duyuru") {
      const text = interaction.options.getString("metin");
      const channel = guild.channels.cache.find(c => c.name === "duyurular" && c.isTextBased());
      if (!channel) return interaction.reply({ content: "Önce /kurulum komutunu kullan.", ephemeral: true });

      await channel.send({ embeds: [embed("📢 SVEYDY DUYURU", text, COLORS.red)] });
      return interaction.reply({ content: "Duyuru gönderildi.", ephemeral: true });
    }

    if (commandName === "bakim") {
      if (maintenance.has(guild.id)) {
        maintenance.delete(guild.id);
        return interaction.reply("🟢 Bakım modu kapatıldı.");
      }
      maintenance.add(guild.id);
      return interaction.reply("🔴 Bakım modu açıldı.");
    }

    if (commandName === "cekilis") {
      const minutes = interaction.options.getInteger("dakika");
      const prize = interaction.options.getString("odul");

      const message = await interaction.reply({
        embeds: [
          embed("🎉 SVEYDY ÇEKİLİŞ", `**Ödül:** ${prize}\n**Bitiş:** ${minutes} dakika sonra\nKatılmak için 🎉 tepkisi bırak!`)
        ],
        fetchReply: true
      });

      await message.react("🎉");

      setTimeout(async () => {
        try {
          const fetched = await message.fetch();
          const reaction = fetched.reactions.cache.get("🎉");
          if (!reaction) {
            return fetched.reply("Çekiliş bitti; katılımcı bulunamadı.");
          }

          const users = await reaction.users.fetch();
          const participants = users.filter(u => !u.bot);
          if (!participants.size) return fetched.reply("Çekiliş bitti; katılımcı bulunamadı.");

          const winner = participants.random();
          await fetched.reply(`🎉 Tebrikler ${winner}! Kazandın: **${prize}**`);
        } catch (err) {
          console.error("Çekiliş hatası:", err);
        }
      }, minutes * 60 * 1000);

      return;
    }
  } catch (error) {
    console.error(error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Bir hata oluştu. Bot izinlerini ve konsol loglarını kontrol et.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const id = key(message.guild.id, message.author.id);

  if (afk.has(id)) {
    afk.delete(id);
    await message.reply("Hoş geldin! AFK durumun kaldırıldı.").catch(() => {});
  }

  for (const user of message.mentions.users.values()) {
    const reason = afk.get(key(message.guild.id, user.id));
    if (reason) {
      await message.reply(`💤 ${user.username} şu anda AFK: ${reason}`).catch(() => {});
    }
  }

  const current = xpData.get(id) || { xp: 0, level: 0 };
  current.xp += Math.floor(Math.random() * 8) + 5;

  const needed = (current.level + 1) * 100;
  if (current.xp >= needed) {
    current.xp -= needed;
    current.level++;
    await message.channel.send(`🎉 ${message.author}, **${current.level}. seviyeye** ulaştın!`).catch(() => {});
  }
  xpData.set(id, current);

  // Basit flood koruması: aynı mesajı arka arkaya atarsa sil.
  const recent = message.channel.messages.cache;
  const duplicate = recent.filter(
    m => m.author.id === message.author.id && m.content === message.content
  ).size > 1;

  if (duplicate && message.member && isStaff(message.member) === false) {
    await message.delete().catch(() => {});
  }
});

client.on("guildMemberAdd", async member => {
  const channel = member.guild.channels.cache.find(
    c => c.name === "hos-geldin" && c.isTextBased()
  );

  if (channel) {
    await channel.send({
      embeds: [
        embed("👋 SVEYDY'YE HOŞ GELDİN", `${member} aramıza katıldı!\nSunucumuzda toplam **${member.guild.memberCount}** üye var.`, COLORS.white)
      ]
    });
  }

  await log(member.guild, `${member.user.tag} sunucuya katıldı.`);
});

client.on("guildMemberRemove", async member => {
  await log(member.guild, `${member.user.tag} sunucudan ayrıldı.`);
});

client.on("messageDelete", async message => {
  if (message.guild && !message.author?.bot) {
    await log(message.guild, `Bir mesaj silindi. Kanal: ${message.channel}`);
  }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
    await log(newMember.guild, `${newMember.user.tag} timeout durumunda değişiklik oldu.`);
  }
});

client.login(TOKEN);
