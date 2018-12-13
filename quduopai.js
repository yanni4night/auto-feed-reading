/**
 * Copyright (c) 2018-present, kuaishou.com
 *
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */
const spawnSync = require('child_process').spawnSync;
const fs = require('fs');
const path = require('path');
const convert = require('xml-js');

let screenWidth = 0;
let screenHeight = 0;


const hiercharyName = 'quduopai.xml';
const hiercharyLocation = '/sdcard/' + hiercharyName;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function click(x, y) {
    spawnSync('adb', ['shell', 'input', 'tap', x, y]);
}

function swipeUp() {
    spawnSync('adb', ['shell', 'input', 'swipe', screenWidth / 2, screenHeight - 100, screenWidth / 2, 100, 500]);
}

function swipeDown() {
    spawnSync('adb', ['shell', 'input', 'swipe', screenWidth / 2, 100, screenWidth / 2, screenHeight - 100, 500]);
}

function swipeRight() {
    spawnSync('adb', ['shell', 'input', 'swipe', 50, screenHeight / 2, screenWidth - 50, screenHeight / 2, 500]);
}


function resolveScreenSize() {
    const out = spawnSync('adb', ['shell', 'wm', 'size']).stdout.toString();
    const matches = out.match(/(\d+)x(\d+)/);
    screenWidth = +matches[1];
    screenHeight = +matches[2];
}


function resolveHierchary() {
    const out = spawnSync('adb', ['shell', 'uiautomator', 'dump', hiercharyLocation]).stdout.toString();
    if (!out.startsWith('UI hierchary dumped to')) {
        throw new Error('resolve hierchary failed: ' + out);
    }
}

function copyHierchary() {
    const out = spawnSync('adb', ['pull', hiercharyLocation, __dirname]).stdout.toString();

    if (!out.startsWith('[100%]')) {
        throw new Error('copy hierchary faild: ' + out);
    }
}

function resolveFavor() {
    const xml = fs.readFileSync(path.join(__dirname, hiercharyName), {
        encoding: 'UTF-8'
    });

    const json = convert.xml2json(xml, {
        compact: false,
        spaces: 4
    });

    const tree = JSON.parse(json);

    const buttons = {
        fire: null,
        play: []
    };

    function parseAxisFromBounds(bounds) {
        const matches = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        const x = (parseInt(matches[1], 10) + parseInt(matches[3], 10)) / 2;
        const y = (parseInt(matches[2], 10) + parseInt(matches[4], 10)) / 2;

        return [x | 0, y | 0];
    }


    JSON.stringify(tree, function (key, value) {
        let matches;
        if ('object' === typeof value && value.text === '我知道了') {
            buttons.fire = parseAxisFromBounds(value.bounds);
        } else if ('object' === typeof value && value['resource-id'] === 'com.xike.yipai:id/iv_like') {
            buttons.play.push({
                axis: parseAxisFromBounds(value.bounds)
            });
        }

        return value;
    });

    return buttons;
}

function print(...args) {
    console.log(`[${new Date().toLocaleString()}]: `, ...args)
}

let cachedFavButton;

async function start() {
    resolveScreenSize();

    while (true) {
        print('next');
        swipeUp();
        await sleep(1000);

        if (!cachedFavButton) {
            print('resolving UI');
            try {
                resolveHierchary();
                copyHierchary();
            } catch (e) {
                console.log('resolve UI faild');
                continue;
            }

            print('resolving play buttons');
            const {
                fire,
                play
            } = resolveFavor();

            if (fire) {
                print('click fire and continue')
                click(...fire);
                continue;
            }


            if (play.length) {
                cachedFavButton = play[0];

            }
        }

        if (cachedFavButton) {
            print('favor ', cachedFavButton.axis);
            click(...cachedFavButton.axis);
        }

        print('play for 5 seconds');
        await sleep(1000 * 5);
    }
}

start();