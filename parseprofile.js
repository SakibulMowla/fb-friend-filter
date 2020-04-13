require("console-stamp")(console, {
    pattern: "dd/mm/yyyy HH:MM:ss.l",
});
const fs = require("fs");
const puppeteer = require("puppeteer");
const config = require("./credential.json");
const filePath = `./friend_${config.username}.json`;
const friends = require(filePath);

const sleep = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

const parseCommaSeparatedNumber = (numberString) => {
    const splitted = numberString.split(",");
    let result = "";
    for (let i = 0; i < splitted.length; i++) {
        result += splitted[i];
    }
    return parseInt(result, 10);
};

const parseInfo = (profileURL, spanTexts, titles) => {
    console.log("Parsing Info");
    console.log("Span text counts ", spanTexts.length);
    console.log("Title counts ", titles.length);

    const info = {
        handle: profileURL.split('https://www.facebok.com/')[1],
        name: null,
        gender: null,
        birthDate: null,
        birthYear: null,
        language: null,
        religion: null,
        institutions: [],
        currentLocation: null,
        homeLocation: null,
        joined: null,
        mutualFriends: null,
        followers: null,
        interestedIn: null,
        linkedIn: null,
        googleTalk: null,
        skype: null,
        familyMember: [],
        mobile: []
    };

    const familyMembers = new Set();
    const mobiles = new Set();

    try {
        for (let i = 1; i < spanTexts.length; i++) {
            if (spanTexts[i] == "Religious Views") {
                info.religion = spanTexts[i - 1];
            } else if (spanTexts[i] == "Interested In") {
                info.interestedIn = spanTexts[i - 1];
            } else if (spanTexts[i] == "Languages") {
                info.language = spanTexts[i - 1];
            } else if (spanTexts[i] == "Birth Year") {
                info.birthYear = spanTexts[i - 1];
            } else if (spanTexts[i] == "Birth Date") {
                info.birthDate = spanTexts[i - 1];
            } else if (spanTexts[i] == "Gender") {
                info.gender = spanTexts[i - 1];
            } else if (spanTexts[i] == "Skype") {
                info.skype = spanTexts[i - 1];
            } else if (spanTexts[i] == "Google Talk") {
                info.googleTalk = spanTexts[i - 1];
            } else if (spanTexts[i] == "LinkedIn") {
                info.linkedIn = spanTexts[i - 1];
            } else if (spanTexts[i] == "Mobile") {
                mobiles.add(spanTexts[i - 1]);
            } else if (
                spanTexts[i] == "Uncle" ||
                spanTexts[i] == "Cousin" ||
                spanTexts[i] == "Brother" ||
                spanTexts[i] == "Sister" ||
                spanTexts[i] == "Nephew" ||
                spanTexts[i] == "Family member"
            ) {
                familyMembers.add(spanTexts[i - 1]);
            } else if (spanTexts[i] == "Current City") {
                info.currentLocation = spanTexts[i - 1];
            } else if (spanTexts[i] == "Hometown") {
                info.homeLocation = spanTexts[i - 1];
            }
        }
        info.familyMember = [...familyMembers];
        info.mobile = [...mobiles];
    } catch (reason) {
        console.error(reason);
    }

    try {
        if (titles.length > 0) {
            info.name = titles[0];
        }
    } catch (reason) {
        console.error(reason);
    }
    console.log(info);
    return info;
};

const pad = (number, length, inRight = true) => {
    let str = number.toString(10);
    while (str.length < length) {
        str = inRight ? ` ${str}` : `${str} `;
    }

    return str;
};

const immediateSecondOcurranceWordRemove = async (items) => {
    for (let i = 0; i < items.length - 1; i++) {
        if (items[i] === items[i + 1]) {
            items.splice(i, 1);
        }
    }
    return items;
};

const browseProfiles = async (page) => {
    const infos = [];
    const length = friends.profiles.length;

    const profileFeatures = [
        "about_overview",
        "about_work_and_education",
        "about_places",
        "about_contact_and_basic_info",
        "about_family_and_relationships",
        "about_details",
        "about_life_events",
    ];

    try {
        for (let i = 0; i < friends.profiles.length; i++) {
            const profileLink = friends.profiles[i];
            console.info(` [${pad(i + 1, 4)} / ${pad(length, 4, false)} ] Going to ${friends.profiles[i]}`);
            let spanInfos = [];
            let h1Infos = [];

            for (let f = 0; f < profileFeatures.length; f++) {
                console.log("Feature page: ", profileFeatures[f]);
                if (profileLink.includes("profile.php?")) {
                    await page.goto(`${profileLink}&sk=${profileFeatures[f]}`);
                } else {
                    await page.goto(`${profileLink}/${profileFeatures[f]}`);
                }
                await sleep(3000);
                let spanTexts = await page.$$eval("span", (spans) =>
                    spans.map((span) => span.textContent)
                );
                spanTexts = await spanTexts.filter((text) => text);
                spanInfos = spanInfos.concat(spanTexts);
            }

            let h1Texts = await page.$$eval("h1", (h1Tags) =>
                h1Tags.map((h1) => h1.textContent)
            );
            h1Texts = await h1Texts.filter((text) => text);
            h1Infos = h1Infos.concat(h1Texts);

            spanInfos = await immediateSecondOcurranceWordRemove(spanInfos);
            infos.push(parseInfo(profileLink, spanInfos, h1Infos));
            break;
        }
    } catch (reason) {
        console.error(reason);
    }

    const knowledgebaseFilePath = `knowledgebase_${config.username}.json`;
    fs.writeFileSync(knowledgebaseFilePath, JSON.stringify({ infos }, null, 4));
};

(async () => {
    let browser;
    if (config.chromiumPath && config.chromiumPath !== "") {
        console.log("Custom chromium path found");
        browser = await puppeteer.launch({
            executablePath: config.chromiumPath,
            headless: config.headless,
            slowMo: 0, // slow down by 30 ms
        });
    } else {
        console.log("Opening with default chromium path");
        browser = await puppeteer.launch({
            headless: config.headless,
            slowMo: 0, // slow down by 30 ms
        });
    }

    const context = browser.defaultBrowserContext();
    context.overridePermissions("https://www.facebook.com", ["notifications"]);

    const page = await browser.newPage();
    await page.goto("https://facebook.com");
    await page.setViewport({
        width: 1500,
        height: 1000,
        deviceScaleFactor: 1,
    });

    // enter email address
    await page.click('[id="email"]');
    await page.keyboard.type(config.username, {
        delay: 0,
    });

    // enter password
    await page.click('[id="pass"]');
    await page.keyboard.type(config.password, {
        delay: 0,
    });

    // click on Log In
    await page.click('[value="Log In"]');

    console.log("Login Done!!!");

    // For new UI
    await page.waitForSelector("[href='/me/']", {
        visiable: true,
    });

    await sleep(3000);

    try {
        await browseProfiles(page);
    } catch (reason) {
        console.error(reason);
    }

    await browser.close();

    console.log("Ending Execution.");
})();