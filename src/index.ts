import * as fs from "fs";
import axios from "axios";
import * as nhp from "node-html-parser";

import commandKinds4RPL from './data/4rpl-command-kinds.json';
import commandKindsIRPL from './data/irpl-command-kinds.json'

processCommands("irpl");

async function processCommands(language: "4rpl" | "irpl") {
    let commands = [];

    const file = fs.readFileSync(`src/data/${language}-commands.html`, "utf-8");
    const lines = file.split(/\r\n/);

    let i = 0;
    for (const line of lines) {
        // For each line, find the url and name.
        const results = line.match(/<a href="(.+)">(.+)<\/a>/);
        if (results == null || results.length < 3) continue; // If none found (should never happen)

        let command = {
            name: results[2],
            displayName: "",
            usage: "",
            url: results[1],
            kind: "Function", // Default to function
            description: ""
        };

        const res = await axios.get(command.url);
        const root = nhp.parse(res.data);
        const content = root.querySelector(".page.group");
        if (content === null) {
            console.error(`Could not find .page.group for ${command.name}.`);
            return;
        }

        const displayName = content.querySelector(`#${command.name.toLowerCase()}`);
        if (displayName === null) {
            console.error(`Could not find command name for ${command.name}.\n${JSON.stringify(command)}`);
            return;
        }
        command.displayName = displayName.innerHTML;

        const usageCandidates = content.querySelectorAll(".level1");

        // Tab elements also have the level1 class, so eliminate those
        const usage = usageCandidates.find(candidate => candidate.tagName === "DIV");
        if (usage !== undefined) command.usage = usage.innerText.trim();

        const description = content.querySelector(".level2");
        if (description !== null) {
            let descriptionText = description.innerHTML.trim();
            // If urls are used in the description, then prepend them with the knucracker url so they work properly.
            descriptionText = descriptionText.replace("href=\"", "href=\"https://knucklecracker.com")

            command.description = descriptionText;
        }

        let commandKinds;
        if (language === "4rpl") commandKinds = commandKinds4RPL;
        else                     commandKinds = commandKindsIRPL;

        for (const [key, value] of Object.entries(commandKinds)) {
            if (value.includes(command.name)) {
                command.kind = key;
            }
        };

        commands.push(command);

        i += 1;
        if (i % 10 == 0) {
            console.log(`${i / lines.length * 100}% complete, just completed ${command.displayName}`);
        }
    }

    fs.writeFileSync(`${language}-commands.json`, JSON.stringify(commands));
}