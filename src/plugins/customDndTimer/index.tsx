/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByCode, findComponentByCodeLazy, findStoreLazy } from "@webpack";
import { ContextMenuApi, FluxDispatcher, Menu, React } from "@webpack/common";

const Button = findComponentByCodeLazy(".GREEN,positionKeyStemOverride:");
const StatusStore = findStoreLazy("StatusStore");

let setStatus: any;
let dndTimer: NodeJS.Timeout | null = null;
let currentTargetStatus: string | null = null;

const settings = definePluginSettings({
    defaultTime: {
        type: OptionType.STRING,
        description: "Default time when opening the custom time dialog (HH:MM format)",
        default: "14:00"
    }
});

function cancelTimer() {
    if (dndTimer) {
        clearTimeout(dndTimer);
        dndTimer = null;
        currentTargetStatus = null;
    }
}

function setDNDUntil(timeStr: string): string {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeStr)) {
        return "Invalid format! Use HH:MM";
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

    cancelTimer();

    try {
        setStatus({ nextStatus: "dnd" });
        currentTargetStatus = "online";

        dndTimer = setTimeout(() => {
            setStatus({ nextStatus: currentTargetStatus || "online" });
            cancelTimer();
        }, timeout);

        return `DND until ${timeStr} (${h}h ${m}m)`;
    } catch (e) {
        return `Error: ${e}`;
    }
}

function onStatusChange() {
    const currentStatus = StatusStore.getStatus();
    
    if (dndTimer && currentStatus !== "dnd") {
        console.log("[CustomDndTimer] Status manually changed, cancelling timer");
        cancelTimer();
    }
}

function DNDTimerIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path
                fill="currentColor"
                d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"
            />
            {dndTimer && (
                <circle cx="19" cy="5" r="4" fill="var(--status-danger)" />
            )}
        </svg>
    );
}

function CancelTimerMenu() {
    return (
        <Menu.Menu navId="dnd-timer-menu" onClose={() => {}}>
            <Menu.MenuItem
                id="dnd-cancel"
                label="Cancel Timer"
                action={() => {
                    cancelTimer();
                    setStatus({ nextStatus: "online" });
                }}
                color="danger"
            />
        </Menu.Menu>
    );
}

function SetTimerMenu() {
    const { defaultTime } = settings.use(["defaultTime"]);
    
    return (
        <Menu.Menu navId="dnd-timer-menu" onClose={() => {}}>
            <Menu.MenuItem
                id="dnd-default"
                label={`Until ${defaultTime} (default)`}
                action={() => setDNDUntil(defaultTime)}
            />
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="dnd-30min"
                label="30 minutes"
                action={() => {
                    const target = new Date();
                    target.setMinutes(target.getMinutes() + 30);
                    const time = `${target.getHours()}:${String(target.getMinutes()).padStart(2, "0")}`;
                    setDNDUntil(time);
                }}
            />
            <Menu.MenuItem
                id="dnd-2h"
                label="2 hours"
                action={() => {
                    const target = new Date();
                    target.setHours(target.getHours() + 2);
                    const time = `${target.getHours()}:${String(target.getMinutes()).padStart(2, "0")}`;
                    setDNDUntil(time);
                }}
            />
            <Menu.MenuItem
                id="dnd-3h"
                label="3 hours"
                action={() => {
                    const target = new Date();
                    target.setHours(target.getHours() + 3);
                    const time = `${target.getHours()}:${String(target.getMinutes()).padStart(2, "0")}`;
                    setDNDUntil(time);
                }}
            />
            <Menu.MenuItem
                id="dnd-6h"
                label="6 hours"
                action={() => {
                    const target = new Date();
                    target.setHours(target.getHours() + 6);
                    const time = `${target.getHours()}:${String(target.getMinutes()).padStart(2, "0")}`;
                    setDNDUntil(time);
                }}
            />
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="dnd-midnight"
                label="Until midnight"
                action={() => setDNDUntil("23:59")}
            />
        </Menu.Menu>
    );
}

function DNDTimerButton(props: any) {  // Füge props hinzu
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => {
        const interval = setInterval(forceUpdate, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        if (dndTimer) {
            ContextMenuApi.openContextMenu(e, CancelTimerMenu);
        } else {
            ContextMenuApi.openContextMenu(e, SetTimerMenu);
        }
    };

    return (
        <Button
            tooltipText={dndTimer ? "DND Timer Active" : "Set DND Timer"}
            icon={DNDTimerIcon}
            onClick={handleClick}
        />
    );
}

export default definePlugin({
    name: "CustomDndTimer",
    description: "Set Do Not Disturb status until a specific time with automatic reset. For specific times use the buildin /dnd-until command. If you always use a specific time set the default time to yours. You can access the plugin with the clock icon on the user card (left from the mute and deafen buttons at the bottom left of your client.)",
    authors: [Devs.avokade],
    settings,

    patches: [
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /children:\[(?=.{0,25}?accountContainerRef)/,
                replace: "children:[$self.DNDTimerButton(arguments[0]),"
            }
        }
    ],

    flux: {
        STATUS_SET: onStatusChange
    },

    start() {
        setStatus = findByCode("updateAsync", "status");
        FluxDispatcher.subscribe("STATUS_SET", onStatusChange);
    },

    stop() {
        cancelTimer();
        FluxDispatcher.unsubscribe("STATUS_SET", onStatusChange);
    },

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
                const result = setDNDUntil(args[0].value);
                sendBotMessage(ctx.channel.id, { content: result });
            }
        },
        {
            name: "dnd-cancel",
            description: "Cancel the DND timer",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (args, ctx) => {
                if (dndTimer) {
                    cancelTimer();
                    setStatus({ nextStatus: "online" });
                    sendBotMessage(ctx.channel.id, { content: "DND timer cancelled" });
                } else {
                    sendBotMessage(ctx.channel.id, { content: "No active timer" });
                }
            }
        }
    ],

    DNDTimerButton: ErrorBoundary.wrap(DNDTimerButton, { noop: true })
});