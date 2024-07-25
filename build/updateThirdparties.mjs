import { default as fs } from "fs/promises";
import { dirname } from "path";


import fg from "fast-glob";

const filtersDir = "filters/thirdparty";
const outDir = "dist/";


async function parseRulesets() {
    const files = await fg.glob([`${filtersDir}/**/rulesets.json`]);

    let rulesets = []
    for (let file of files) {

        let src = await fs.readFile(file, "utf8");
        let additionalRulesets = JSON.parse(src);

        rulesets.push(...additionalRulesets);
    }

    return rulesets;
}

async function downloadFilterlistRecursive(url) {
    let response = await fetch(url);

    if (response.ok) {
        let txt = await response.text();

        let out = []
        for (let line of txt.split("\n")) {
            if (line.startsWith("!#include")) {

                let includePath = line.split("!#include")[1].trim();

                let baseUrl = new URL(url);
                baseUrl.pathname = dirname(baseUrl.pathname) + "/" + includePath;

                try {
                    out.push(await downloadFilterlistRecursive(baseUrl.toString()));
                } catch (error) {
                    console.log("nested", error);
                    throw Error(`Couldn't download: ${baseUrl.toString()}`)
                }
            } else {
                out.push(line)
            }
        }
        return out.join("\n");
    }
    throw Error(`Couldn't download: ${url}`)
}

async function main() {

    let rulesets = await parseRulesets();


    for (let ruleset of rulesets) {
        let { id, urls } = ruleset;

        let txt = []

        for (let url of urls) {
            // urls may contain multiple backup urls pointing to the same list
            // we try until successfull
            let stack = Array.isArray(url) ? url : [url];

            let success = false;

            for (let curUrl of stack) {
                try {
                    txt.push(await downloadFilterlistRecursive(curUrl));
                    // Break out if we had success
                    success = true;
                    break;
                } catch (error) {
                    //console.log(error);
                    console.warn(`Failed to download "${id}" from "${curUrl}", trying alternative source next.`);
                }
            }

            // None of the urls worked and we didn't download the list
            if (!success) {
                throw Error(`Failed to download "${id}", tried:\n\n> ${stack.join("\n> ")}\n`);
            }

        }
        await fs.writeFile(`${filtersDir}/${id.toLowerCase()}.txt`, txt.join("\n"), "utf8");
    }
}

await main();
