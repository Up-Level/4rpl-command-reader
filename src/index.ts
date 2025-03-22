import * as fs from "fs";
import axios from "axios";
import * as nhp from "node-html-parser";
import * as htmlEntities from 'html-entities';

import commandKinds4RPL from './data/4rpl-command-kinds.json';
import commandKindsIRPL from './data/irpl-command-kinds.json';
import invalidCommandsIRPL from './data/irpl-invalid-commands.json';

processCommands("irpl");

async function processCommands(language: "4rpl" | "irpl") {

    let commandEntries: nhp.HTMLElement[];
    // Currently reading the index directly is only supported for IRPL
    if (language === "irpl") {
        //const indexWikiId = language === "4rpl" ? "4rpl:index" : "ixe:irpl:index";
        const res = await axios.get("https://knucklecracker.com/wiki/doku.php?id=ixe:irpl:index");
        const root = nhp.parse(res.data);
        const commandList = root.querySelector(".plugin_nspages")?.childNodes as nhp.HTMLElement[];
    
        commandEntries = commandList.filter(command => {
            return command.rawTagName === "a" &&
                  !invalidCommandsIRPL.includes(htmlEntities.decode(command.innerText));
        });
    
        if (commandEntries === undefined) {
            console.error("Could not parse command index.");
            return;
        }
        console.log(`Found ${commandEntries.length} entries in command index.`);
    }
    else {
        const file = fs.readFileSync(`src/data/${language}-commands.html`, "utf-8").replace(/\r\n/g, "");
        const root = nhp.parse(file);
        commandEntries = root.childNodes as nhp.HTMLElement[];
    }
    let commands = [];

    let i = 0;
    for (const entry of commandEntries) {
        let command = {
            name: entry.innerText,
            displayName: "",
            usage: "",
            url: "https://knucklecracker.com" + entry.getAttribute("href"),
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
            console.log(`${i / commandEntries.length * 100}% complete, just completed ${command.displayName}`);
        }
    }

    fs.writeFileSync(`${language}-commands.json`, JSON.stringify(commands));
}