const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

function parseBanDuration(input) {
    if (!input || typeof input !== "string") return { expiresAt: null, display: "permanently" };

    const trimmed = input.trim();
    if (!trimmed) return { expiresAt: null, display: "permanently" };

    const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?)?$/i);
    if (isoMatch) {
        const expiresAt = new Date(trimmed);
        if (!Number.isNaN(expiresAt.getTime())) {
            return { expiresAt, display: `until ${expiresAt.toUTCString()}` };
        }
    }

    const match = trimmed.match(/^([0-9]+)\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|w|month|mo|mon|year|yr|y)$/i);
    if (!match) {
        return null;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const expiresAt = new Date();

    if (["second", "sec", "s"].includes(unit)) {
        expiresAt.setSeconds(expiresAt.getSeconds() + amount);
        return { expiresAt, display: `for ${amount} second(s)` };
    }
    if (["minute", "min", "m"].includes(unit)) {
        expiresAt.setMinutes(expiresAt.getMinutes() + amount);
        return { expiresAt, display: `for ${amount} minute(s)` };
    }
    if (["hour", "hr", "h"].includes(unit)) {
        expiresAt.setHours(expiresAt.getHours() + amount);
        return { expiresAt, display: `for ${amount} hour(s)` };
    }
    if (["day", "d"].includes(unit)) {
        expiresAt.setDate(expiresAt.getDate() + amount);
        return { expiresAt, display: `for ${amount} day(s)` };
    }
    if (["week", "w"].includes(unit)) {
        expiresAt.setDate(expiresAt.getDate() + amount * 7);
        return { expiresAt, display: `for ${amount} week(s)` };
    }
    if (["month", "mo", "mon"].includes(unit)) {
        expiresAt.setMonth(expiresAt.getMonth() + amount);
        return { expiresAt, display: `for ${amount} month(s)` };
    }
    if (["year", "yr", "y"].includes(unit)) {
        expiresAt.setFullYear(expiresAt.getFullYear() + amount);
        return { expiresAt, display: `for ${amount} year(s)` };
    }

    return null;
}

module.exports = {
    commandInfo: {
        name: "ban",
        description: "Ban a user from the backend by their username.",
        options: [
            {
                name: "username",
                description: "Target username.",
                required: true,
                type: 3
            },
            {
                name: "duration",
                description: "Duration (examples: 1h, 2d, 1w, 1mo, 1y, 2026-12-31). Leave empty for permanent.",
                required: false,
                type: 3
            },
            {
                name: "reason",
                description: "Reason for the ban.",
                required: false,
                type: 3
            },
            {
                name: "type",
                description: "Ban type: account or matchmaking",
                required: false,
                type: 3,
                choices: [
                    { name: "account", value: "account" },
                    { name: "matchmaking", value: "matchmaking" }
                ]
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!config.moderators.includes(interaction.user.id)) {
            return interaction.editReply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        const { options } = interaction;
        const username = options.get("username").value;
        const durationStr = options.get("duration")?.value;
        const reason = options.get("reason")?.value || "No reason provided";
        const banType = (options.get("type")?.value || "account").toLowerCase();

        const targetUser = await User.findOne({ username_lower: username.toLowerCase() });

        if (!targetUser) return interaction.editReply({ content: "The account username you entered does not exist.", ephemeral: true });

        const parsedDuration = parseBanDuration(durationStr);
        if (durationStr && !parsedDuration) {
            return interaction.editReply({ content: "Invalid duration format! Use values like 1h, 2d, 1w, 1mo, 1y, or 2026-12-31.", ephemeral: true });
        }

        const banExpires = parsedDuration ? parsedDuration.expiresAt : null;
        const durationDisplay = parsedDuration ? parsedDuration.display : "permanently";
        const isMatchmakingBan = banType === "matchmaking";

        if (isMatchmakingBan) {
            if (targetUser.matchmakingBanned && !targetUser.matchmakingBanUntil) {
                return interaction.editReply({ content: "This account is already permanently matchmaking-banned.", ephemeral: true });
            }

            await targetUser.updateOne({
                $set: {
                    matchmakingBanned: true,
                    matchmakingBanUntil: banExpires,
                    matchmakingBanReason: reason,
                }
            });

            if (targetUser.discordId) {
                try {
                    const discordUser = await interaction.client.users.fetch(targetUser.discordId);
                    const embed = new MessageEmbed()
                        .setTitle("Matchmaking Ban")
                        .setDescription(`Your account **${targetUser.username}** has been matchmaking-banned on **Reload Backend**.`)
                        .setColor("#ff9900")
                        .addFields(
                            { name: "Reason", value: reason, inline: true },
                            { name: "Duration", value: durationDisplay, inline: true }
                        );
                    if (banExpires) embed.addField("Expires on", banExpires.toUTCString());
                    await discordUser.send({ embeds: [embed] });
                } catch (err) {
                    // ignore DM failures
                }
            }

            return interaction.editReply({ content: `Successfully matchmaking-banned **${targetUser.username}** ${durationDisplay}.`, ephemeral: true });
        }

        if (targetUser.banned && !targetUser.banExpires && !targetUser.bannedUntil) {
            return interaction.editReply({ content: "This account is already permanently banned.", ephemeral: true });
        }

        await targetUser.updateOne({
            $set: {
                banned: true,
                bannedUntil: banExpires,
                banExpires: banExpires,
                banReason: reason,
            }
        });

        let refreshToken = global.refreshTokens.findIndex(i => i.accountId == targetUser.accountId);
        if (refreshToken != -1) global.refreshTokens.splice(refreshToken, 1);

        let accessToken = global.accessTokens.findIndex(i => i.accountId == targetUser.accountId);
        if (accessToken != -1) {
            global.accessTokens.splice(accessToken, 1);

            let xmppClient = global.Clients.find(client => client.accountId == targetUser.accountId);
            if (xmppClient) xmppClient.client.close();
        }

        if (accessToken != -1 || refreshToken != -1) functions.UpdateTokens();

        let dmStatus = "";
        if (targetUser.discordId) {
            try {
                const discordUser = await interaction.client.users.fetch(targetUser.discordId);
                const banEmbed = new MessageEmbed()
                    .setTitle("Account Banned")
                    .setDescription(`Your account **${targetUser.username}** has been banned from **Reload Backend**.`)
                    .setColor("#ff0000")
                    .addFields({
                        name: "Reason",
                        value: reason,
                        inline: true
                    }, {
                        name: "Duration",
                        value: durationDisplay,
                        inline: true
                    })
                    .setTimestamp()
                    .setFooter({
                        text: "Reload Backend Admin Team",
                        iconURL: "https://i.imgur.com/2RImwlb.png"
                    });

                if (banExpires) {
                    banEmbed.addField("Expires on", banExpires.toUTCString());
                }

                banEmbed.addField("How to Appeal", "If you believe this was a mistake, you can use the `/appeal` command in our Discord server or this chat.");

                await discordUser.send({ embeds: [banEmbed] });
                dmStatus = " (User notified via DM)";
            } catch (err) {
                dmStatus = " (Could not DM user - DMs closed or user not found)";
            }
        } else {
            dmStatus = " (User has no linked Discord ID)";
        }

        interaction.editReply({ content: `Successfully banned **${targetUser.username}** ${durationDisplay}.${dmStatus}`, ephemeral: true });
    }
}