import { default as fs } from "fs";
import { default as readline } from "readline";

import { basename } from "path";

import fg from "fast-glob";


const filtersDir = "filters/";
const outDir = "dist/";

function formatDate(match, line) {
    const now = new Date().toISOString();
    return `${match[1]}${now}`;
}

const expandPatterns = [
    [new RegExp(/^([^%]*)%timestamp%$/, ), formatDate],
]

function expandLine(line) {
    for (let [re, func] of expandPatterns) {
        const match = re.exec(line);
        if (match) {
            return func(match, line);
        }
    }
    return line;
}

async function renderFilterList(inFile) {
    const inFileStream = fs.createReadStream(inFile);
    const inFileRL = readline.createInterface({ input: inFileStream, crlfDelay: Infinity });

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir);
    }

    const outFile = basename(inFile);
    const outFileHandle = await fs.openSync(`${outDir}${outFile}`, "w+");

    for await (const line of inFileRL) {
        fs.writeSync(outFileHandle, expandLine(line) + "\n")
    }

    fs.closeSync(outFileHandle);
}

async function main() {
    const files = await fg.glob([`${filtersDir}/**/*.txt`]);
    
    for (let file of files) {
        renderFilterList(file);
    }
}

await main();