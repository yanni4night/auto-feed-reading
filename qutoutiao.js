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


const hiercharyName = 'qutoutiao.xml';
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

function resolveVideoPlay() {
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
        } else if ('object' === typeof value && (matches = String(value.text).match(/^(\d{2}):(\d{2})$/))) {
            const mins = parseInt(matches[1], 10);
            const sens = parseInt(matches[2], 10);
            buttons.play.push({
                axis: parseAxisFromBounds(value.bounds),
                // we play half only
                duration: ((mins * 60 + sens) / 2) | 0
            });
        }

        return value;
    });

    return buttons;
}

function print(...args) {
    console.log(`[${new Date().toLocaleString()}]: `, ...args)
}

async function start() {
    resolveScreenSize();

    while (true) {
        print('refresh list');
        swipeUp();
        await sleep(2000);

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
        } = resolveVideoPlay();

        if (fire) {
            print('click fire and continue')
            click(...fire);
            continue;
        }

        let button;
        switch (play.length) {
        case 0:
            continue;
            break;
        case 1:
            button = play[0];
            break;
        case 2:
        case 3:
            button = play[1];
            break;
        default:
            button = play[Math.floor(play.length / 2)];
        }

        print('click ', button.axis);
        click(...button.axis);

        print('play for ' + button.duration + ' seconds');
        await sleep(1000 * button.duration);
    }
}

start();