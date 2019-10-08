class Input {
    static makeKeyMapper(numKeys) {
        var bindingPairs = [];
        switch (numKeys) {
            case 4:
                bindingPairs = [
                    // dfjk
                    //[68, 0],
                    //[70, 1],
                    //[74, 2],
                    //[75, 3]
                    ['S'.charCodeAt(0), 0],
                    ['D'.charCodeAt(0), 1],
                    ['K'.charCodeAt(0), 2],
                    ['L'.charCodeAt(0), 3]
                ];
                break;
            case 5:
                bindingPairs = [
                    ['S'.charCodeAt(0), 0],
                    ['D'.charCodeAt(0), 1],
                    [32, 3],
                    ['K'.charCodeAt(0), 2],
                    ['L'.charCodeAt(0), 3]
                ];
                break;
            case 6:
                bindingPairs = [
                    [83, 0],
                    [68, 1],
                    [70, 2],
                    [74, 4],
                    [75, 5],
                    [76, 6]
                ];
                break;
            case 7:
                bindingPairs = [
                    [83, 0],
                    [68, 1],
                    [70, 2],
                    [32, 3],
                    [74, 4],
                    [75, 5],
                    [76, 6]
                ];
                break;
            }
            var bindings = [];
            for (var _i = 0; _i < bindingPairs.length; _i++) {
                var _a = bindingPairs[_i], k = _a[0], c = _a[1];
                bindings[k] = c;
            }
            return (k) => {
            var c = bindings[k];
            if (c === undefined)
                return -1;
            return c;
        };
    }
}

Input.KeyEvent = class {
    constructor(key, time, state) {
        this.key = key;
        this.time = time;
        this.state = state;
    }
};

class Game {
    constructor(numKeys, harness) {
        this.lastAcc = 100;
        this.state = new Mania.State(numKeys);
        this.mapKeyToColumn = Input.makeKeyMapper(numKeys);
        this.timingHarness = harness;
        this.newKeyEvents = [];
        this.showtries = false;
    }

    update(t) {
        this.timingHarness.update();
        this.state.time = this.timingHarness.time();
        var now = Util.getTime();
        for (var _i = 0, _a = this.newKeyEvents; _i < _a.length; _i++) {
            var evt = _a[_i];
            var col = this.mapKeyToColumn(evt.key);
            if (col >= 0) {
                var t_1 = (evt.time - now) + this.timingHarness.time();
                this.state.keys[col].push(new Mania.KeyEvent(col, t_1, evt.state));
            }
        }
        this.newKeyEvents.length = 0;
        this.updateAccuracy();
    }
    updateAccuracy() {
        var acc = this.state.accuracy() * 100;
        if (acc !== this.lastAcc) {
            this.lastAcc = acc;
            var cc = (this.state.accuracy() * 100).toFixed(2);
            document.getElementById("acc").innerHTML = (isNaN(cc)) ? 0 : cc;
        }
    }
}

class Mania {
    constructor() {
        Mania.MAX_SCORE = 1000000;
    }

    static keyStateAtTime(column, time, keys) {
        var kCol = keys[column];
        var k = Util.binarySearchRange(kCol, false, (x) => { return x.time - 0; }, (x) => { return x.time - time; });
        if (k === -1)
            return false;
        return kCol[k].state;
    }

    static findHit(time, column, keys, state) {
        if (state === undefined || state === null)
            state = true;
        var kCol = keys[column];
        var low = 0;
        var high = kCol.length - 1;
        var mid = -1;
        while (low <= high) {
            mid = (low + high) >> 1;
            var x = kCol[mid];
            if (x.time < time - Mania.NOTE_MISS_THRESHOLD)
                low = mid + 1;
            else if (x.time > time + Mania.NOTE_MISS_THRESHOLD)
                high = mid - 1;
            else
                break;
        }
        var index = mid === -1 ||
            kCol[mid].time < time - Mania.NOTE_MISS_THRESHOLD ||
            kCol[mid].time > time + Mania.NOTE_MISS_THRESHOLD ? -1 : mid;
        if (index === -1)
            return null;
        for (var i = index; i >= 0; i--) {
            var x = kCol[i];
            if (x.time < time - Mania.NOTE_MISS_THRESHOLD)
                break;
            if (x.state === state)
                return x;
        }
        for (var i = index; i < kCol.length; i++) {
            var x = kCol[i];
            if (x.time > time + Mania.NOTE_MISS_THRESHOLD)
                break;
            if (x.state === state)
                return x;
        }
        return null;
    }

    static scoreForNoteHit(deltaTime) {
        var t = Math.abs(deltaTime) / Mania.NOTE_MISS_THRESHOLD;
        if (t > 1.0)
            return 0;
        var a = -4.365525372;
        var b = 10.6077809;
        var c = -7.88579993;
        var d = 0.6435444042;
        var e = 1;
        var t2 = t * t; var t3 = t2 * t;
        var t4 = t3 * t;
        var baseScore = t4 * a + t3 * b + t2 * c + t * d + e;
        return Math.max(50, Mania.quantizeScore(baseScore * 320));
    }

    static quantizeScore(score) {
        if (score <= 0)
            return 0;
        if (score > 0 && score < 50)
            return 50;
        if (score > 50 && score < 100)
            return 100;
        if (score > 100 && score < 200)
            return 200;
        if (score > 200 && score < 300)
            return 300;
        if (score > 300)
            return 320;
        return score;
    }
}

Mania.NOTE_MISS_THRESHOLD = 110;

Mania.State = class {
    constructor(numKeys) {
        this.notes = [];
        this.notesSortedByEndTime = [];
        this.time = 0;
        this.keys = new Array(numKeys);
        for (var i = 0; i < numKeys; i++) {
            this.keys[i] = [];
        }
        Object.defineProperty(this, "numKeys", {
            get: () => {
                return this.keys.length;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "bpm", {
            get: () => {
                var t = this.time;
                var e = _.findLast(this.timingEvts, (x) => { return x.time <= t; });
                return e ? e.bpm : 120;
            },
            enumerable: true,
            configurable: true
        });
    }

    setNotes(notes) {
        this.notes = _.clone(notes);
        this.notesSortedByEndTime = _.clone(notes);
        this.notes.sort((a, b) => { return a.time - b.time; });
        this.notesSortedByEndTime.sort((a, b) => { return a.endTime - b.endTime; });
    }

    accuracyWithThreshold(threshold) {
        var t = this.time;
        var keys = this.keys;
        var notes = this.notes;
        var max = 0;
        var total = 0;
        for (var _i = 0; _i < notes.length; _i++) {
            var x = notes[_i];
            if (x.endTime > t)
                break;
            max += threshold;
            total += Math.min(threshold, x.noteScore(keys));
        }
        return total / max;
    }

    accuracy() {
        return this.accuracyWithThreshold(300);
    }

    score() {
        return this.accuracyWithThreshold(320) * Mania.MAX_SCORE;
    }
    combo() {
        var time = this.time;
        var keys = this.keys;
        var interval = this.bpm / 4;
        var combo = 0;
        for (var _i = 0, _a = this.notes; _i < _a.length; _i++) {
            var x = _a[_i];
            if (x.time > time)
                break;
            var c = x.column;
            if (Mania.findHit(x.time, c, keys))
                combo++;
            else if (time - x.time > Mania.NOTE_MISS_THRESHOLD)
                combo = 0;
            if (x.sustain) {
                var maxTime = Math.min(time, x.endTime);
                for (var t = x.time; t < maxTime; t += interval) {
                    if (Mania.keyStateAtTime(x.column, t, keys))
                        combo++;
                    else if (t > x.time + Mania.NOTE_MISS_THRESHOLD &&
                        t < x.endTime - Mania.NOTE_MISS_THRESHOLD)
                        combo = 0;
                }
            }
        }
        return combo;
    }
    
    lastNoteHit() {
        var t = this.time;
        var keys = this.keys;
        var notes = this.notesSortedByEndTime;
        var i = Util.binarySearchRange(notes, false, (x) => { return x.endTime - 0; }, (x) => { return x.endTime - t; });
        if (i === -1)
            return null;
        for (; i >= 0; i--) {
            var x = notes[i];
            var hit = x.noteHitInfo(keys);
            if (hit.time <= t)
                return hit;
        }
        return null;
    }
};

Mania.HitInfo = class {
    constructor(s, t) {
        this.score = s;
        this.time = t;
    }
};

Mania.NoteEvent = class {
    constructor(column, time, sustainTime) {
        this.column = column;
        this.time = time;
        this.sustain = !!sustainTime;
        this.sustainDuration = sustainTime || 0;
        Object.defineProperty(this, "endTime", {
            get: () => {
                return this.time + this.sustainDuration;
            },
            enumerable: true,
            configurable: true
        });
    }

    noteHitInfo(keys) {
        var column = this.column;
        var key = Mania.findHit(this.time, column, keys);
        var score = key ? Mania.scoreForNoteHit(key.time - this.time) : 0;
        var time;
        if (this.sustain) {
            var endTime = this.endTime;
            var endKey = Mania.findHit(endTime, column, keys, false);
            score += endKey ? Mania.scoreForNoteHit(endKey.time - endTime) : 0;
            score = Mania.quantizeScore(score / 2);
            time = endKey ? endKey.time : endTime + Mania.NOTE_MISS_THRESHOLD;
        }
        else {
            time = key ? key.time : this.time + Mania.NOTE_MISS_THRESHOLD;
        }
        return new Mania.HitInfo(score, time);
    }

    noteScore(keys) {
        return this.noteHitInfo(keys).score;
    }
};

Mania.KeyEvent = class {
    constructor(column, time, state) {
        this.column = column;
        this.time = time;
        this.state = state;
    }
};

Mania.TimingEvent = class {
    constructor(time, bpm) {
        this.time = time;
        this.bpm = bpm;
    }
};

class Osu {
    static parseTimingPoint(ln) {
        var args = ln.split(",");
        var time = parseInt(args[0], 10);
        var bpm = parseFloat(args[1]);
        return new Osu.TimingPoint(time, bpm);
    }

    static parseHitObject(ln) {
        var args = ln.split(",");
        var x = parseInt(args[0], 10);
        var y = parseInt(args[1], 10);
        var time = parseInt(args[2], 10);
        var extArgs = args[5].split(":");
        var hit = new Osu.HitObject(x, y, time);
        if (extArgs.length === 6) {
            hit.holdEndTime = parseInt(extArgs[0], 10);
        }
        return hit;
    }

    static readMap(contents, mapName, p) {
        var partial = p || false;
        var lines = _.map(contents.split(/\r?\n/), (ln) => { return ln.trim(); });
        function readSection(section) {
            var match = "[" + section + "]";
            return _(lines)
                .dropWhile((x) => { return x !== match; })
                .drop()
                .takeWhile((x) => { return x.charAt(0) !== "["; })
                .filter((x) => { return x.length > 0; })
                .value();
        }
        function findMatch(rgx, lns) {
            return _(lns).map((x) => { return x.match(rgx); })
                .find((x) => { return x !== null; });
        }
        function readSetting(setting) {
            var val = findMatch(new RegExp(setting + ":(.*)$"), lines);
            return val ? val[1].trim() : null;
        }
        function readIntSetting(x) {
            return parseInt(readSetting(x), 10);
        }
        var map = new Map();
        map.mapName = mapName || "";
        map.audioFilename = readSetting("AudioFilename");
        map.mode = readIntSetting("Mode");
        map.numKeys = readIntSetting("CircleSize");
        map.title = readSetting("Title");
        map.artist = readSetting("Artist");
        map.diff = readSetting("Version");
        var eventLines = readSection("Events");
        var bgImgMatch = findMatch(/^0,0,"([^"]*)"/, eventLines);
        if (bgImgMatch)
            map.backgroundImageFilename = bgImgMatch[1];
        var bgVideoMatch = findMatch(/Video,([-\d]*),"([^"]*)"/, eventLines);
        if (bgVideoMatch) {
            map.backgroundVideoOffset = parseInt(bgVideoMatch[1], 10);
            map.backgroundVideoFilename = bgVideoMatch[2];
        }
        if(map.mapName === "")
            map.mapName = map.artist+" - "+map.title;
        if(partial)
            return map;

        map.audioLeadIn = readIntSetting("AudioLeadIn");
        map.previewTime = readIntSetting("PreviewTime");
        map.sampleSet = readSetting("SampleSet");
        map.timingPoints = _.map(readSection("TimingPoints"), Osu.parseTimingPoint);
        map.hitObjects = _.map(readSection("HitObjects"), Osu.parseHitObject);
        for (var i = 1; i < map.timingPoints.length; i++) {
            var y = map.timingPoints[i - 1];
            var x = map.timingPoints[i];
            if (x.bpm < 0)
                x.bpm = y.bpm;
        }
        return map;
    }
}

Osu.MapsetStream = class {
    constructor() {
        this._maps = [];
    }

    static load(basePath, onload) {
        var mapset = new Osu.MapsetStream();
        mapset.basePath = basePath;
        async.waterfall([
            (cb) => {
                Util.readFile(basePath + "/index.json", cb);
            },
            (jsonFile, cb) => {
                var json;
                try {
                    json = JSON.parse(jsonFile);
                }
                catch (parseErr) {
                    cb(parseErr, null);
                }
                cb(null, json['mapFiles']);
            },
            (mapFilePaths, cb) => {
                async.map(mapFilePaths, (path, f) => { return Util.readFile(basePath + "/" + path, f); }, (err, xs) => { return cb(err, xs, mapFilePaths); });
            },
            (mapContents, mapFilePaths, cb) => {
                var pairs = _.zip(mapContents, mapFilePaths);
                mapset._maps = _.map(pairs, (_a) => {
                    var x = _a[0], name = _a[1];
                    return Osu.readMap(x, name);
                });
                cb(null, mapset);
            }
        ], onload);
    }

    maps() { return this._maps; }

    fileURI(filename) {
        return this.basePath + "/" + filename;
    }
};

Osu.MapsetOsz = class {
    constructor() {
        this._maps = [];
        this.fileData = {};
    }
    
    load(oszFile, onload) {
        var mapset = new MapsetOsz();
        function read(contents) {
            var zip = new JSZip();
            zip.load(contents, {});
            var osuFiles = zip.file(/[^\.]*\.osu/);
            mapset._maps = _.map(osuFiles, (x) => { return readMap(x.asText(), x.name); });
            var allFiles = zip.filter(() => { return true; });
            for (var _i = 0; _i < allFiles.length; _i++) {
                var f = allFiles[_i];
                mapset.fileData[f.name] = f.asBinary();
            }
            onload(null, mapset);
        }
        if (typeof oszFile === "string") {
            Util.readBinaryFile(oszFile, (err, x) => {
                if (err) {
                    onload(err, null);
                }
                else {
                    read(x);
                }
            });
        }
        else {
            read(oszFile);
        }
    }

    maps() { return this._maps; }

    fileURI(filename) {
        var data = this.fileData[filename];
        if (data) {
            var mimeType = Util.mimeTypeForExtension(Util.fileExtension(filename));
            return "data:" + mimeType + ";base64," + btoa(data);
        }
        else {
            return null;
        }
    }
};

Osu.Map = class {
    constructor() {
        this.mapName = "";
    }
};

Osu.TimingPoint = class {
    constructor(time, bpm) {
        this.time = time;
        this.bpm = bpm;
    }
};

Osu.HitObject = class {
    constructor(x, y, time) {
        this.x = x;
        this.y = y;
        this.time = time;
        this.holdEndTime = time;
    }

    noteColumn(numKeys) {
        return (this.x / 512 * numKeys) | 0;
    }
};

class GameRenderer {
    constructor() {
        Object.defineProperty(this, "boardHeight", {
            get: () => { return this.screenHeight; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "boardWidth", {
            get: () => { return this.keyWidth * this.numKeys; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "boardScale", {
            get: () => { return this.boardHeight / 768; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "keyWidth", {
            get: () => { return (45 * 1024 / 768 * this.boardScale) | 0; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "keyHeight", {
            get: () => { return (2 / 10 * this.boardHeight) | 0; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "keyCapHeight", {
            get: () => { return (15 / 90 * this.keyHeight) | 0; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "noteHeight", {
            get: () => { return this.keyCapHeight; },
            enumerable: true,
            configurable: true
        });
    }

    resize(screenWidth, screenHeight, numKeys) {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.numKeys = numKeys;
    }

    static keyBrightness(column, game) {
        var keys = game.keys[column];
        var k = Util.binarySearchRange(keys, false, (x) => { return x.time - 0; }, (x) => { return x.time - game.time; });
        if (k === -1)
            return 0.0;
        var evt = keys[k];
        var dt = game.time - evt.time;
        var atk = 20;
        var dec = 150;
        if (evt.state) {
            return Math.min(dt / atk, 1.0);
        }
        else {
            if (dt > dec)
                return 0.0;
            else
                return 1.0 - (dt / dec);
        }
    };
}

class GameRenderer2D extends GameRenderer {
    constructor(canvas) {
        super();
        this.canvas = canvas;
    }

    _set_skin(skin) {
        this.skin = skin;
    }
    
    init(skin) {
        this.canvas.style.visibility = '';
        this.ctx = this.canvas.getContext("2d");
    }

    resize(screenWidth, screenHeight, numKeys) {
        super.resize(screenWidth, screenHeight, numKeys);
        this.canvas.width = this.boardWidth;
        this.canvas.height = this.boardHeight;
        this.canvas.style.left = ((screenWidth - this.boardWidth) >> 1) + "px";
        this.ctx.font = ((40 * this.boardScale) | 0) + "px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
    }

    renderNote(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, this.keyWidth, this.noteHeight);
    }

    renderSustain(x, yBottom, yTop, noteColor, sustainColor) {
        var sustainW = (this.keyWidth * 0.75) | 0;
        var sustainX = x + ((this.keyWidth - sustainW) >> 1);
        var sustainY = yTop + this.noteHeight;
        this.ctx.fillStyle = sustainColor;
        this.ctx.fillRect(sustainX, sustainY, sustainW, yBottom - sustainY);
        this.renderNote(x, yTop, noteColor);
        this.renderNote(x, yBottom, noteColor);
    }

    renderNotes(game) {
        var numKeys = game.numKeys;
        var boardWidth = this.boardWidth;
        var boardHeight = this.boardHeight;
        var keyWidth = this.keyWidth;
        var keyHeight = this.keyHeight;
        var noteHeight = this.noteHeight;
        var noteArea = boardHeight - keyHeight;
        var ctx = this.ctx;
        var t = game.time;
        var timeVisible = 750;
        var timePerPixel = timeVisible / boardHeight;
        var startVisible = t - (timePerPixel * keyHeight) | 0;
        var endVisible = t + (timePerPixel * noteArea) | 0;
        var keyStates = new Array(numKeys);
        for (var i = 0; i < keyStates.length; i++)
            keyStates[i] = Mania.keyStateAtTime(i, t, game.keys);
        var notes = game.notes;
        var noteIndex = Util.binarySearchNearest(notes, (x) => { return x.time - startVisible; });
        if (noteIndex === -1)
            return;
        for (var col = 0; col < numKeys; col++) {
            while (noteIndex > 0) {
                var x = notes[noteIndex];
                if (x.column === col && x.endTime < t - startVisible)
                    break;
                noteIndex--;
            }
        }
        for (var i = noteIndex; i < notes.length; i++) {
            var note = notes[i];
            if (note.time > endVisible)
                break;
            var column = note.column;
            var x = column * keyWidth;
            var y = ((1.0 - (note.time - startVisible) / timeVisible) * boardHeight - noteHeight) | 0;
            var hit = Mania.findHit(note.time, note.column, game.keys);
            if (hit && hit.time > t)
                hit = null;
            var color = hit ? this.skin.keysLighter[column].hexString
                : this.skin.keys[column].hexString;
            if (note.sustain) {
                var yTop = (y - note.sustainDuration / timePerPixel) | 0;
                var sustainColor = void 0;
                if (hit)
                    sustainColor = keyStates[column] ? this.skin.keysGradient[10][column].hexString
                        : this.skin.keys[column].hexString;
                else
                    sustainColor = this.skin.keysSustain[column].hexString;
                this.renderSustain(x, y, yTop, color, sustainColor);
            }
            else {
                this.renderNote(x, y, color);
            }
        }
    }

    render(game, skin, loading) {
        if(skin === null)
            return;
        var numKeys = game.numKeys;
        var boardWidth = this.boardWidth;
        var boardHeight = this.boardHeight;
        var keyWidth = this.keyWidth;
        var keyHeight = this.keyHeight;
        var keyCapHeight = this.keyCapHeight;
        var noteHeight = this.noteHeight;
        var noteArea = boardHeight - keyHeight;
        var ctx = this.ctx;
        ctx.clearRect(0, 0, boardWidth, boardHeight);
        this.renderNotes(game);
        for (var i = 0; i < numKeys; i++) {
            var brightness = GameRenderer.keyBrightness(i, game);
            var brightIndex = Math.min(brightness * skin.keysGradient.length, skin.keysGradient.length - 1) | 0;
            var color = skin.keysGradient[brightIndex][i].hexString;
            var cap = skin.keyCapsGradient[brightIndex][i].hexString;
            var x = keyWidth * i;
            var y = boardHeight - keyHeight;
            ctx.fillStyle = cap;
            ctx.fillRect(x, y, keyWidth, keyCapHeight);
            ctx.fillStyle = color;
            ctx.fillRect(x, y + keyCapHeight, keyWidth, keyHeight - keyCapHeight);
        }
        if(game.time < 1000.0 && !game.showtries) {
            document.getElementById("tries_container").style.visibility = 'visible';
            game.showtries = true;
        }

        if(game.time > 1000.0 && game.showtries) {
            document.getElementById("tries_container").style.visibility = '';
            game.showtries = false;
        }
        if (game.time < 4000.0) {
            ctx.fillStyle = "#FFF";
            ctx.globalAlpha = 1.0 - ((game.time - 3000.0) / 1000.0);
            var x = keyWidth >> 1;
            var y = boardHeight - ((keyHeight - keyCapHeight) >> 1);
            if (numKeys === 4) {
                ctx.fillText("S", x, y);
                ctx.fillText("D", x + keyWidth, y);
                ctx.fillText("K", x + keyWidth * 2, y);
                ctx.fillText("L", x + keyWidth * 3, y);
            }
            else if (numKeys === 7) {
                ctx.fillText("S", x, y);
                ctx.fillText("D", x + keyWidth, y);
                ctx.fillText("F", x + keyWidth * 2, y);
                ctx.fillText("Sp", x + keyWidth * 3, y);
                ctx.fillText("J", x + keyWidth * 4, y);
                ctx.fillText("K", x + keyWidth * 5, y);
                ctx.fillText("L", x + keyWidth * 6, y);
            }
            ctx.globalAlpha = 1.0;
        }
        if (loading) {
            ctx.fillStyle = "#FFF";
            ctx.fillText("Loading", boardWidth >> 1, boardHeight >> 1);
        }
        var combo = game.combo();
        if (combo > 0) {
            ctx.fillStyle = "#FFF";
            ctx.fillText(combo.toString(), boardWidth >> 1, boardHeight * 0.2);
        }
        if (skin !== null) {
            var lastHit = game.lastNoteHit();
            if (lastHit) {
                var t = game.time - lastHit.time;
                var hitScale;
                var atk = 40;
                var rel = 75;
                var sustain = 50;
                if (t < atk) {
                    hitScale = (t / atk) * 0.4 + 1.0;
                }
                else if (t < atk + rel) {
                    hitScale = (1.0 - ((t - atk) / rel)) * 0.4 + 1.0;
                }
                else {
                    hitScale = 1.0;
                }
                if (t < atk + rel + sustain) {
                    var hitImg;
                    switch (lastHit.score) {
                        case 0:
                            hitImg = skin.maniaHit0;
                            break;
                        case 50:
                            hitImg = skin.maniaHit50;
                            break;
                        case 100:
                            hitImg = skin.maniaHit100;
                            break;
                        case 200:
                            hitImg = skin.maniaHit200;
                            break;
                        case 300:
                            hitImg = skin.maniaHit300;
                            break;
                        case 320:
                            hitImg = skin.maniaHit320;
                            break;
                    }
                    var hitW = keyWidth * 1.8;
                    var hitH = hitW / hitImg.width * hitImg.height;
                    hitW *= hitScale;
                    hitH *= hitScale;
                    var hitX = (numKeys * keyWidth - hitW) >> 1;
                    var hitY = boardHeight - keyHeight - noteHeight * 2.4 - (hitH >> 1);
                    ctx.drawImage(hitImg, hitX, hitY, hitW | 0, hitH | 0);
                }
            }
        }
    }
}

class Color {
    constructor(r, g, b) {
        this._r = Math.max(0, Math.min(0xFF, r)) | 0;
        this._g = Math.max(0, Math.min(0xFF, g)) | 0;
        this._b = Math.max(0, Math.min(0xFF, b)) | 0;
        this._hex = null;

        Object.defineProperty(this, "r", {
            get: () => {
                return this._r;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "g", {
            get: () => {
                return this._g;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "b", {
            get: () => {
                return this._b;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "rgb", {
            get: () => {
                return this._r << 16 | this._g << 8 | this._b;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(this, "hexString", {
            get: () => {
                if (this._hex === null) {
                    this._hex = "#" + (this.rgb | 0x1000000).toString(16).substring(1);
                }
                return this._hex;
            },
            enumerable: true,
            configurable: true
        });
    }

    scale(factor) {
        var r = this.r * factor;
        var g = this.g * factor;
        var b = this.b * factor;
        return new Color(r, g, b);
    }

    static fromRGB(rgb) {
        var r = (rgb >> 16) & 0xFF;
        var g = (rgb >> 8) & 0xFF;
        var b = (rgb >> 0) & 0xFF; return new Color(r, g, b); }
}

class SoundSet {
    
}

class Skin {
    constructor(numKeys) {
        this.hitsounds = [];
        if(numKeys == 4) {
            this.keys = Skin.keys4k;
        }
        else if(numKeys == 5) {
            this.keys = Skin.keys5k;
        }
        else if(numKeys == 6) {
            this.keys = Skin.keys6k;
        }
        else {
            this.keys = Skin.keys7k;
        }
        this.keysSustain = _.map(this.keys, (c) => { return c.scale(0.75); });
        this.keysLighter = _.map(this.keys, (c) => { return c.scale(1.5); });
        this.keysGradient = _.map(_.range(0.0, 1.01, 0.05), (s) => {
            return _.map(_.zip(this.keys, this.keysLighter), (_a) => {
                var x = _a[0], y = _a[1];
                var r = y.r * s + x.r * (1.0 - s);
                var g = y.g * s + x.g * (1.0 - s);
                var b = y.b * s + x.b * (1.0 - s);
                return new Color(r, g, b);
            });
        });
        this.keyCapsGradient = _.map(this.keysGradient, (x) => { return _.map(x, (c) => { return c.scale(0.8); }); });
    }

    static loadSkin(path, numKeys, audioContext, cb) {
        Util.loadResources([
            { type: 1, path: "soft-hitclap.wav" },
            { type: 1, path: "soft-hitfinish.wav" },
            { type: 1, path: "soft-hitnormal.wav" },
            { type: 1, path: "soft-hitwhistle.wav" },
            { type: 1, path: "soft-slidertick2.wav" },
            { type: 0, path: "mania-hit0.png" },
            { type: 0, path: "mania-hit50.png" },
            { type: 0, path: "mania-hit100.png" },
            { type: 0, path: "mania-hit200.png" },
            { type: 0, path: "mania-hit300.png" },
            { type: 0, path: "mania-hit300g.png" }
        ], audioContext, path, (res) => {
            var skin = new Skin(numKeys);
            var soft = new SoundSet();
            soft.hitclap = res["soft-hitclap.wav"];
            soft.hitfinish = res["soft-hitfinish.wav"];
            soft.hitnormal = res["soft-hitnormal.wav"];
            soft.hitwhistle = res["soft-hitwhistle.wav"];
            soft.slidertick2 = res["soft-slidertick2.wav"];
            skin.hitsounds[0] = soft;
            skin.maniaHit0 = res["mania-hit0.png"];
            skin.maniaHit50 = res["mania-hit50.png"];
            skin.maniaHit100 = res["mania-hit100.png"];
            skin.maniaHit200 = res["mania-hit200.png"];
            skin.maniaHit300 = res["mania-hit300.png"];
            skin.maniaHit320 = res["mania-hit300g.png"];
            cb(skin);
        });
        document.getElementById("pause").style.background = 'rgba(0,0,0,0.3) url('+path+'/pause-overlay.png) no-repeat';
    }
}

Skin.keys7k = [
    Color.fromRGB(0x6E2E8D),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x6E2E8D),
    Color.fromRGB(0x8D842E),
    Color.fromRGB(0x6E2E8D),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x6E2E8D),
];

Skin.keys6k = [
    Color.fromRGB(0x6E2E8D),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x6E2E8D),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x6E2E8D),
];

Skin.keys5k = [
    Color.fromRGB(0x6E2E8D),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x8D842E),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x6E2E8D),
];

Skin.keys4k = [
    Color.fromRGB(0x6E2E8D),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x363B73),
    Color.fromRGB(0x6E2E8D),
];

Skin.SOUNDS_SOFT = 0;

class Timing {
}

Timing.AudioHarness = class {
    constructor(board) {
        this.timeOffset = 0;
        this.timeSlew = 0;
        this._audio = null;
        this._paused = false;
        this._audioTimeUpdateListener = (evt) => {
            var lT = this._audioTime;
            var lU = this._lastAudioTimeUpdate;
            this._audioTime = this._audio.currentTime * 1000;
            this._lastAudioTimeUpdate = Util.getTime();
            if (this._stopped) {
                this._lastUpdate = this._lastAudioTimeUpdate;
                this._firstAudioTimeUpdate = this._lastAudioTimeUpdate;
                this._stopped = false;
            }
            var dT = (this._audioTime - lT);
            var dU = (this._lastAudioTimeUpdate - lU);
            if (Math.abs(dU - dT) > 85) {
                this._firstAudioTimeUpdate = this._lastAudioTimeUpdate - this._audioTime;
            }
        };
        this._audioEndedListener = (evt) => {
            this._audioTime = this._audio.currentTime * 1000;
            this._lastAudioTimeUpdate = Util.getTime();
            this._stopped = true;
            board._audioEndedListener();
        };
        this.reset();
    }

    setAudioSource(audio) {
        if (this._audio) {
            this._audio.addEventListener('onplaying', this._audioTimeUpdateListener);
            this._audio.removeEventListener('timeupdate', this._audioTimeUpdateListener);
            this._audio.removeEventListener('ended', this._audioEndedListener);
        }
        this._audio = audio;
        if (audio) {
            audio.removeEventListener('onplaying', this._audioTimeUpdateListener);
            audio.addEventListener('timeupdate', this._audioTimeUpdateListener);
            audio.addEventListener('ended', this._audioEndedListener);
        }
        this.reset();
    }

    reset() {
        this._audioTime = 0;
        this._lastUpdate = -1;
        this._firstAudioTimeUpdate = -1;
        this._lastAudioTimeUpdate = -1;
        this._stopped = true;
    }

    update() {
        if(this._paused)
            return;

        if (this._stopped) {
            this._baseTime = this._audioTime;
            return;
        }
        var now = Util.getTime();
        var prevTime = this._baseTime;
        var audioT = this._audioTime + (now - this._lastAudioTimeUpdate);
        var time = now - this._firstAudioTimeUpdate;
        var dif = time + this.timeSlew - audioT;
        var dt = (now - this._lastUpdate) / 16.66666667;
        if (Math.abs(dif) > 30) {
            var x = dif - 30;
            var slewAdjust = 0.006 * x * x * dt;
            if (dif < 0)
                this.timeSlew += slewAdjust;
            else
                this.timeSlew -= slewAdjust;
        }
        this._baseTime = time;
        this._lastUpdate = now;
    }

    time() {
        return this._baseTime + this.timeOffset + this.timeSlew;
    }

    baseTime() {
        return this._baseTime;
    }
};

class Util {
    static getMillisSinceEpoch() {
        if (Date.now)
            return () => { return Date.now(); };
        else
            return () => { return +(new Date()); };
    }

    static getTime() {
        if (window.performance && window.performance.now)
            return (() => { return window.performance.now(); })();
        else
            return Util.getMillisSinceEpoch;
    }

    static binarySearchNearest(xs, f) {
        var low = 0;
        var high = xs.length - 1;
        var mid = -1;
        while (low <= high) {
            mid = (low + high) >> 1;
            var x = xs[mid];
            var c = f(x);
            if (c < 0)
                low = mid + 1;
            else if (c > 0)
                high = mid - 1;
            else
                return mid;
        }
        return mid;
    }

    static binarySearch(xs, f) {
        if (xs.length === 0)
            return -1;
        var i = binarySearchNearest(xs, f);
        return f(xs[i]) === 0 ? i : -1;
    }

    static binarySearchRange(xs, minimize, l, h) {
        if (xs.length === 0)
            return -1;
        var i;
        if (minimize) {
            i = binarySearchNearest(xs, l);
            while (i > 0) {
                if (l(xs[i - 1]) < 0)
                    break;
                i--;
            }
            while (i < xs.length - 1) {
                if (l(xs[i]) >= 0)
                    break;
                i++;
            }
        }
        else {
            i = Util.binarySearchNearest(xs, h);
            while (i < xs.length - 1) {
                if (h(xs[i + 1]) > 0)
                    break;
                i++;
            }
            while (i > 0) {
                if (h(xs[i]) <= 0)
                    break;
                i--;
            }
        }
        if (l(xs[i]) < 0 || h(xs[i]) > 0)
            return -1;
        return i;
    }

    static compareRange(x, low, high) {
        if (x < low)
            return -1;
        if (x > high)
            return 1;
        return 0;
    }

    static readDirectory(path, cb) {
        Util.readFile(path, (err, g) => {
            if(!err) {
                var a = g.getElementsByTagName('a');
                var nms = [];
                for(var i = 5 ; i < a.length; i++) {
                    var n = a[i].childNodes[0].nodeValue;
                    nms.push(n);
                }
                cb(null, nms);
            } else { cb(err, null); }
        }, 'document');
    }

    static readFile(path, cb, responseType) {
        var req = new XMLHttpRequest();
        req.onload = () => {
            if (req.status !== 200)
                cb("Error loading " + path, null);
            else
                cb(null, req.response);
        };
        req.responseType = responseType || "text";
        req.onerror = (err) => { return cb(err, null); };
        req.open("GET", path, true);
        req.send();
    }

    static readBinaryFile(path, cb) {
        Util.readFile(path, cb, "arraybuffer");
    }
    
    static loadResources(resources, audioContext, rootPath, onload) {
        function loadImage(path, cb) {
            var img = new Image();
            img.onload = () => { return cb(null, img); };
            img.onerror = (err) => { return cb(err, null); };
            img.src = path;
        }
        function loadSound(path, cb) {
            Util.readBinaryFile(path, (err, data) => {
                if (err)
                    return cb(err, null);
                try {
                    audioContext.decodeAudioData(data, (buffer) => { return cb(null, buffer); }, function () { return cb("Error decoding sound from " + path, null); });
                }
                catch (err) {
                    cb(err, null);
                }
            });
        }
        async.map(resources, (x, cb) => {
            var type = x.type;
            var path = rootPath + "/" + x.path;
            function onData(err, data) {
                if (err)
                    console.log(err);
                cb(null, [x.path, data]);
            }
            var loader;
            switch (type) {
                case 0:
                    loader = loadImage;
                    break;
                case 1:
                    loader = loadSound;
                    break;
            }
            loader(path, onData);
        }, (err, xs) => { return onload(_.zipObject(xs)); });
    }

    static fileExtension(fileName) {
        var match = fileName.match(/.([^\.]*)$/);
        return match ? match[1] : "";
    }

    static mimeTypeForExtension(fileExtension) {
        switch (fileExtension.toLowerCase()) {
            case "mp3": return "audio/mpeg";
            case "ogg": return "audio/ogg";
            case "wav": return "audio/wav";
            case "png": return "image/png";
            case "jpg": return "image/jpeg";
            case "jpeg": return "image/jpeg";
            case "bmp": return "image/bmp";
            case "gif": return "image/gif";
            case "avi": return "video/avi";
            case "mp4": return "video/mp4";
            case "ogg": return "video/ogg";
            case "flv": return "video/flv";
            case "txt": return "text/plain";
            case "osu": return "text/plain";
        }
        console.log("Unknown MIME type for file extension " + fileExtension);
        return "text/plain";
    }
}

// i don't even know anymore what that's supposed to do...
var ResourceType;
(function (ResourceType) {
    ResourceType[ResourceType["IMAGE"] = 0] = "IMAGE";
    ResourceType[ResourceType["SOUND"] = 1] = "SOUND";
})(ResourceType || (ResourceType = {}));

class GameAudio {
    constructor() {
        try {
            this.ctx = new AudioContext();
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = 0.28 * 0.3;
            this.gainNode.connect(this.ctx.destination);
        }
        catch (e) {
            console.log("No WebAudio support");
        }
    }

    playSound(sound) {
        if (!this.ctx) {
            return;
        }
        this.src = this.ctx.createBufferSource();
        this.src.buffer = sound;
        this.src.connect(this.gainNode);
        this.src.start(0);
    }
}

class GameManager {
    constructor() {
        this._gb = null;
        this.tries = 0;
        this._songsmenu = document.querySelector('.menu.songs');
        this._menu = document.querySelector('.menu');
        this.detect_songs();
        this.preview = {};
        this.preview.name = "";
    }

    _init(total) {
        this.menu = true;
        this._imax = total-1;
        this._i = Math.floor((this._imax+1)/2);
        this._select(this._i);
        document.onkeydown = (evt) => {
            var k = evt.keyCode & 0xFF;
            if(k == 38) {
                this._i--;
                this._deselect(this._icheck('up'));
                this._select(this._i);
            }
            else if(k == 40) {
                this._i++;
                this._deselect(this._icheck('down'));
                this._select(this._i);
            }
            else if(k == 13) { // enter
                var diff = this.diffs[this._i];
                var a = diff.path.split('/');
                var dir = a.slice(0,3).join('/');
                var name = a[3];
                this.hide_menu();
                this._fadeout();
                setTimeout(() => {this._new(dir,name,diff.map.numKeys);}, 600);
            }
        };
        this._songsmenu.focus();
    }

    hide_menu() {
        this._menu.style.visibility = 'hidden';
    }

    show_menu() {
        this._menu.style.visibility = '';
    }

    detect_songs() {
        var maps = [];
        Util.readDirectory("assets/songs", (err, nms) => {
            nms.forEach((rootf) => {
                Util.readFile("assets/songs/"+rootf+"index.json", (err, r) => {
                    if(!err) {
                        var j = JSON.parse(r);
                        var _maps = [];
                        var _m = {};
                        j.mapFiles.forEach((map) => {
                            var path = "assets/songs/"+rootf+map;
                            Util.readFile(path, (err, raw) => {
                                var map = Osu.readMap(raw, "", true);
                                var m = {};
                                m.map = map;
                                m.path = path;
                                _maps.push(m);
                            });
                        });
                        _m.maps = _maps;
                        _m.rootf = rootf;
                        maps.push(_m);
                        //this.populate(_m);
                    }
                });
            });
        });
        setTimeout(() => {this.populate(maps)}, 2000);
    }

    populate(maps) {
        this.maps = maps;
        this.diffs = [];
        var len = 0;
        maps.forEach((mapL) => {
            mapL.maps.forEach((m) => {
                var map = m.map;
                var s = document.createElement("div");
                s.classList.add('song');
                var i = document.createElement('img');
                i.src = 'assets/song.png';
                s.appendChild(i);
                var cw = document.createElement('div');
                cw.classList.add('cwrap');
                var c = document.createElement('div');
                c.classList.add('content');
                var title = document.createElement('span');
                title.innerHTML = map.mapName;
                title.classList.add('title');
                c.appendChild(title);
                var diff = document.createElement('span');
                diff.innerHTML = map.diff;
                c.appendChild(diff);
                cw.appendChild(c);
                s.appendChild(cw);
                this._songsmenu.appendChild(s);
                this.diffs.push(m);
                len++;
            });
        });
        setTimeout(() => {this._init(len);}, 500);
    }

    _select(id) {
        document.getElementsByClassName("song")[id].classList.add("selected");
        var diff = this.diffs[id];
        var a = diff.path.split('/');
        var dir = a.slice(0,3).join('/');
        if(diff.map.backgroundImageFilename)
        {
            var bg = dir+"/"+diff.map.backgroundImageFilename;
            document.body.style.background = "url(" + bg + ") no-repeat center center fixed";
            document.body.style.backgroundSize = "cover";
        }
        if(this._i >= 2) {
            this._songsmenu.scrollTo(0,(70*(this._i-2)));
        }
        else {
            this._songsmenu.scrollTo(0,0);
        }

        if(this.preview.name !== diff.map.mapName) {
            this.preview.name = diff.map.mapName;
            if(this.preview.audio) {
                this.preview.audio.pause();
            }

            this.preview.audio = new Audio();
            this.preview.audio.autoplay = true;
            //song.volume = 0.50;
            this.preview.audio.volume = 0.90;
            this.preview.audio.src = dir+"/"+diff.map.audioFilename;
            this.preview.audio.currentTime = 30;
        }
    }

    _fadeout() {
        var fadeAudio = setInterval(() => {
            if(this.preview.audio.volume === null) {
                clearInterval(fadeAudio);
                return;
            }

            if (this.preview.audio.volume > 0.0) {
                this.preview.audio.volume -= 0.1;
            }
            if (this.preview.audio.volume <= 0.01) {
                clearInterval(fadeAudio);
                this.preview.audio.pause();
                this.preview.audio = null;
            }
        }, 90);
    }

    _deselect(id) {
        document.getElementsByClassName("song")[id].classList.remove("selected");
    }

    _icheck(o) {
        if(this._i < 0) {
            this._i = this._imax;
            return 0;
        }
        else if (this._i > this._imax) {
            this._i = 0;
            return this._imax;
        }
        else return (o === 'up') ? this._i+1 : this._i-1;
    }

    _set_gb(gb) {
        if(gb === null) {
            this.show_menu();
        }

        this._gb = gb;
    }

    _new(mapname, diff, numKeys) {
        this._gb = new GameManager.GameBoard(this, mapname, diff, numKeys);
        document.getElementById("tries").innerHTML = '';
    }

    retry(mapname, diff, numKeys) {
        this._new(mapname, diff, numKeys);
        this.tries++;
        if(this.tries > 0)
            document.getElementById("tries").innerHTML = this.tries;
    }
}

var gm = new GameManager();

GameManager.GameBoard = class {
    constructor(_gm, mapname, diff, numKeys) {
        this.canvas = document.getElementById("game_canvas");
        document.getElementById("acc_container").style.visibility = '';
        this.harness = new Timing.AudioHarness(this);
        this.harness.timeOffset = 5;
        var numkeys = numKeys || 4;
        this.game = new Game(numkeys, this.harness);
        this.skin = null;
        this.audio = new GameAudio();
        this.renderer = new GameRenderer2D(this.canvas);
        this.keys = new Uint8Array(256);
        this.loading = true;
        this.stopped = false;
        this._gm = _gm;
        
        this.canvas.onkeydown = (evt) => {
            var k = evt.keyCode & 0xFF;
            if(k == 27) // esc
                this.pause();

            if(k == 'Q'.charCodeAt(0) && this.harness._paused) {
                this._unpause();
                setTimeout(() => {this.stop();}, 200);
            }

            if(this.harness._paused)
                return;

            if(k == 192) // gravetick
            {
                this._stop();
                _gm.retry(mapname, diff, numkeys);
                return;
            }

            if (this.keys[k] === 0) {
                this.game.newKeyEvents.push(new Input.KeyEvent(k, Util.getTime(), true));
                this.keys[k] = 1;
                if (this.skin !== null)
                    this.audio.playSound(this.skin.hitsounds[0].hitnormal);
            }
        };
        this.canvas.onkeyup = (evt) => {
            var k = evt.keyCode & 0xFF;
            if (this.keys[k] === 1) {
                this.game.newKeyEvents.push(new Input.KeyEvent(k, Util.getTime(), false));
                this.keys[k] = 0;
            }
        };
        this.canvas.onblur = (evt) => {
            setTimeout(() => { return this.canvas.focus(); }, 0);
        };
        document.body.onclick = (evt) => {
            setTimeout(() => { return this.canvas.focus(); }, 0);
        };
        this.canvas.focus();

        async.waterfall([
            (cb) => {
                Skin.loadSkin("assets/aesthetic", numkeys, this.audio.ctx, (sk) => {
                    this.skin = sk;
                    this.renderer._set_skin(sk);
                    console.log("Loaded skin");
                    cb(null);
                });
            },
            (cb) => {
                return Osu.MapsetStream.load(mapname, cb);
            },
            (mapset, cb) => {
                var map = _.find(mapset.maps(), (x) => {
                    return x.mapName === diff;
                });
                if (map)
                    cb(null, mapset, map);
                else
                    cb("Couldn't find osu file!");
            },
            (mapset, map, cb) => {
                if (map.backgroundImageFilename) {
                    var bg = mapset.fileURI(map.backgroundImageFilename);
                    document.body.style.background = "url(" + bg + ") no-repeat center center fixed";
                    document.body.style.backgroundSize = "cover";
                }
                var notes = _.map(map.hitObjects, (x) => {
                    if (x.holdEndTime === x.time) {
                        return new Mania.NoteEvent(x.noteColumn(this.game.state.numKeys), x.time);
                    }
                    else {
                        return new Mania.NoteEvent(x.noteColumn(this.game.state.numKeys), x.time, x.holdEndTime - x.time);
                    }
                });
                this.game.state.setNotes(notes);
                this.game.state.timingEvts = _.map(map.timingPoints, (x) => { return new Mania.TimingEvent(x.time, x.bpm); });
                var song = new Audio();
                song.autoplay = true;
                //song.volume = 0.50;
                song.volume = 0.90;
                song.src = mapset.fileURI(map.audioFilename);
                song.addEventListener('timeupdate', () => {
                    cb(null, song);
                });
                this.harness.setAudioSource(song);
            }
        ], (err, song) => {
            console.log("Done Loading.");
            this.loading = false;
        });
        this.renderer.init(this.skin);
        window.onresize = this.onResize.bind(this);
        this.onResize();
        window.requestAnimationFrame(this.update.bind(this));
    }

    clear_events() {
        this.canvas.onkeydown = null;
        this.canvas.onkeyup = null;
        this.canvas.onblur = null;
        document.body.onclick = null;
        window.onresize = null;
    }

    _audioEndedListener() {
        setTimeout(() => {this.stop();}, 2000);
    }

   _stop() {
        this.harness._audio.pause();
        this.harness._stopped = true;
        this.harness.reset();
        this.clear_events();
        this.stopped = true;
   }

    stop() {
        this.renderer.canvas.style.visibility = 'hidden';
        document.getElementById("acc_container").style.visibility = 'hidden';
        document.body.style.background = "";
        this._stop();
        setTimeout(() => {this._gm._set_gb(null);}, 500);
    }

    _unpause() {
        if(this.harness._paused) {
            document.getElementById("pause").style.visibility = '';
            setTimeout(() => {document.getElementById("acc_container").style.color = '#fff';}, 1000);
        }
    }

    pause() {
        if(!this.harness._paused) {
            this.harness._audio.pause();
            this.harness._paused = true;
            document.getElementById("pause").style.visibility = 'visible';
            document.getElementById("acc_container").style.color = '#131313';
        }
        else {
            this.harness._audio.play();
            this.harness._paused = false;
            document.getElementById("pause").style.visibility = '';
            document.getElementById("acc_container").style.color = '#fff';
        }
    }

    update(t) {
        if(this.game == null)
            return;

        this.game.update(t);
        this.renderer.render(this.game.state, this.skin, this.loading);
        if(!this.stopped)
            setTimeout(this.update.bind(this), 0);
    }

    onResize() {
        this.renderer.resize(window.innerWidth, window.innerHeight, this.game.state.numKeys);
    }
};
