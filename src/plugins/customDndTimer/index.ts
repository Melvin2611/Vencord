/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";

const UserSettingsProtoStore = findByPropsLazy("PreloadedUserSettingsActionCreators");

let dndTimer: NodeJS.Timeout | null = null;

export default definePlugin({
    name: "CustomDndTimer",
    description: "Set Do Not Disturb status until a specific time",
    authors: Devs.Melvin2611,

    commands: [
        {
            name: "dnd-until",
            description: "Set DND until a specific time",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "time",
                    description: "Time in HH:MM format (e.g. 14:00)",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: (args, ctx) => {
                const timeStr = args[0].value;
                const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
                
                if (!timeRegex.test(timeStr)) {
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ Invalid format! Use HH:MM (e.g. 14:00)"
                    });
                    return;
                }

                const [hours, minutes] = timeStr.split(":").map(Number);
                const now = new Date();
                const target = new Date();
                
                target.setHours(hours, minutes, 0, 0);
                
                if (target < now) {
                    target.setDate(target.getDate() + 1);
                }
                
                const timeout = target.getTime() - now.getTime();
                const h = Math.floor(timeout / 3600000);
                const m = Math.floor((timeout % 3600000) / 60000);

                if (dndTimer) clearTimeout(dndTimer);

                try {
                    UserSettingsProtoStore.PreloadedUserSettingsActionCreators.updateAsync(
                        "status",
                        (s: any) => { s.status.value = "dnd"; }
                    );

                    dndTimer = setTimeout(() => {
                        UserSettingsProtoStore.PreloadedUserSettingsActionCreators.updateAsync(
                            "status",
                            (s: any) => { s.status.value = "online"; }
                        );
                        dndTimer = null;
                    }, timeout);

                    sendBotMessage(ctx.channel.id, {
                        content: `🔕 DND active until ${timeStr} (${h}h ${m}m)`
                    });
                } catch (e) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${e}`
                    });
                }
            }
        },
        {
            name: "dnd-cancel",
            description: "Cancel the DND timer",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (args, ctx) => {
                if (dndTimer) {
                    clearTimeout(dndTimer);
                    dndTimer = null;
                    
                    UserSettingsProtoStore.PreloadedUserSettingsActionCreators.updateAsync(
                        "status",
                        (s: any) => { s.status.value = "online"; }
                    );
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ DND timer cancelled"
                    });
                } else {
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ No active timer"
                    });
                }
            }
        }
    ],

    start() {},
    
    stop() {
        if (dndTimer) {
            clearTimeout(dndTimer);
            dndTimer = null;
        }
    }
});
