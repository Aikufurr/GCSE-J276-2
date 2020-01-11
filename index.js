const express = require('express');
const app = express();
const port = 5001;
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const fs = require("fs");
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));
app.use(cookieParser()); // Allows access to cookies

var server = app.listen(port, () => console.log(`app listening on port ${port}!`))

const io = require("socket.io")(server)

const gameRounds = 10;

Array.prototype.remove = function () {
    var what, a = arguments,
        L = a.length,
        ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

var users = {};

var games = {};

function readJSON(file) {
    return JSON.parse(fs.readFileSync(`./${file}`, `utf8`));
}

function saveJSON(file, data) {
    fs.writeFileSync(`./${file}`, JSON.stringify(data));
}

if (fs.existsSync("users.json")) {
    users = readJSON("users.json");
} else {
    users = {
        "48245ea3-c240-45ce-baa3-5ce0a1105a4d": {
            "name": "kade",
            "psk": "nintendo",
            "wins": 0
        },
        "904001c1-0f51-4c3a-a1ab-4ecaaafcf05f": {
            "name": "nicole",
            "psk": "tags",
            "wins": 0
        }
    };

    saveJSON("users.json", users);
}

function getRandomCode() {
    var letters = '0123456789ABCDEFGHIKGLMNOPQRSTUVWXYZ';
    var code = '';
    for (var i = 0; i < 6; i++) {
        code += letters[Math.floor(Math.random() * letters.length)];
    }
    return code;
}

function getDice() {
    var letters = '123456';
    var roll = 0;
    for (var i = 0; i < 1; i++) {
        let letter = letters[Math.floor(Math.random() * letters.length)];

        roll += parseInt(letter);
    }
    return roll;
}

function getTwoDice() {
    let letters = '123456';
    let first = letters[Math.floor(Math.random() * letters.length)];
    let second = letters[Math.floor(Math.random() * letters.length)];
    let isDouble = false;

    if (first == second) {
        isDouble = true;
    }

    let roll = parseInt(first) + parseInt(second);
    return { roll, isDouble };
}

function isEven(n) {
    return n % 2 == 0;
}

function isOdd(n) {
    return Math.abs(n % 2) == 1;
}

app.get('/:room?', (req, res) => {
    if (req.params.room == null) {
        // res.redirect("/" + getRandomCode());
        res.sendfile("views/index.html");
        return;
    }
    if (req.cookies["token"]) {
        res.sendfile("views/game.html")
    } else {
        res.sendfile("views/login.html");
    }
});

app.get("/login/:room?", (req, res) => {
    res.sendfile("views/login.html");
})

app.post("/login", (req, res) => {
    var keys = Object.keys(users);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if ((users[key]["name"] === req.body["uname"]) && (users[key]["psk"] === req.body["psw"])) {
            res.cookie('token', key, {
                httpOnly: false
            })
            res.redirect(`/${req.body["code"]}`)
            return;
        }
    }
    res.redirect(`/${req.body["code"]}`)
})

// use cookies https://github.com/Aikufurr/inv-mng


io.sockets.on('connection', (socket) => {
    console.log("We have a new client: " + socket.id);

    socket.on("index", (_) => {

        let usersList = Object.keys(users);

        let wins = {}

        for (let i = 0; i < usersList.length; i++) {
            wins[users[usersList[i]]["name"]] = users[usersList[i]]["wins"]
        }

        socket.emit("index", { "games": games, "leaderboard": wins });
    });

    socket.on("init", (data) => {
        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {
                "misc": {
                    "round": 0,
                    "turn": ""
                }
            };
        }
        if (!games[data["code"]].hasOwnProperty("misc")) {
            games[data["code"]]["misc"] = {
                "round": 0,
                "turn": ""
            };
        }
        let turn;
        try {
            turn = games[data["code"]]["misc"]["turn"] || {};
        } catch (e) {
            turn = "";
        }
        let gData = games[data["code"]] || {};

        socket.emit("init", { "turn": turn, "data": gData });
    });

    socket.on("login", (data) => {
        console.log(data)
        var keys = Object.keys(users);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if ((users[key]["name"] === data["uname"]) && (users[key]["psk"] === data["psw"])) {
                socket.emit("login", { "success": key })
                return;
            }
        }
        socket.emit("login", "error");
    });


    socket.on("start", (data) => {
        if (data["reset"] == 1) {
            gdata = games[data["code"]];
            delete games[data["code"]];

            if (!games.hasOwnProperty(data["code"])) {
                games[data["code"]] = {
                    "misc": {
                        "round": 0,
                        "turn": ""
                    }
                };
            }
            if (!games[data["code"]].hasOwnProperty("misc")) {
                games[data["code"]]["misc"] = {
                    "round": 0,
                    "turn": ""
                };
            }

            let keys = Object.keys(gdata);

            keys.remove("misc");

            for (let i = 0; i < keys.length; i++) {
                games[data["code"]][keys[i]] = {
                    "name": users[keys[i]]["name"],
                    "wins": 0,
                    "points": 0
                }
            }
        }

        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {
                "misc": {
                    "round": 0,
                    "turn": ""
                }
            };
        }

        let keys = Object.keys(games[data["code"]]);

        keys.remove("misc");

        games[data["code"]]["misc"]["turn"] = games[data["code"]]["misc"]["turn"] == "" ? data["token"] : games[data["code"]]["misc"]["turn"];


        if (keys.length != 2) {
            socket.emit("start", { "error": "not-full" });
        } else {
            io.emit("start", { "code": data["code"], "data": games[data["code"]] });
        }
    });

    socket.on("join", (data) => {
        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {
                "misc": {
                    "round": 0,
                    "turn": ""
                }
            };
        }

        let keys = Object.keys(games[data["code"]]);

        keys.remove("misc");

        if (keys.length > 1) {
            socket.emit("join", { "error": "full" });
        } else {
            if (!games[data["code"]].hasOwnProperty(data["token"])) {
                games[data["code"]][data["token"]] = {
                    "name": users[data["token"]]["name"],
                    "wins": 0,
                    "points": 0
                }
            }
            io.emit("userUpdateEvent", { "code": data["code"], "data": games[data["code"]] });
        }
    });

    socket.on("userUpdateEvent", (data) => {
        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {};
        }

        if (data["type"] == "join") {
            let keys = Object.keys(games[data["code"]]);
            keys.remove("misc");
            if (keys.length > 1) {
                socket.emit("userUpdateEvent", { "error": "full" });
            } else {
                if (!games[data["code"]].hasOwnProperty(data["token"])) {
                    games[data["code"]][data["token"]] = {
                        "name": users[data["token"]]["name"],
                        "wins": 0,
                        "points": 0
                    }
                }
                io.emit("userUpdateEvent", { "code": data["code"], "data": games[data["code"]] });
            }
        } else if (data["type"] == "leave") {
            delete games[data["code"]][data["token"]]
            let keys = Object.keys(games[data["code"]]);
            keys.remove("misc");
            if (keys.length == 1) {
                games[data["code"]]["misc"]["round"] = 0;
            }
            if (keys.length == 0) {
                delete games[data["code"]];
                io.emit("userUpdateEvent", { "code": data["code"], "data": {} });
            } else {
                io.emit("userUpdateEvent", { "code": data["code"], "data": games[data["code"]] });
            }

        }
    });
    //
    // SCHEDULED FOR DELETION
    //
    // socket.on("rollDouble", (data) => {
    //     let points = games[data["code"]][data["token"]]["points"];
    //     points += getDice();
    //     games[data["code"]][data["token"]]["points"] = points;
    //     games[data["code"]]["round"] = games[data["code"]]["round"] == null ? 1 : games[data["code"]]["round"] + 1;
    //     games[data["code"]]["misc"]["turn"] = games[data["code"]]["misc"]["turn"] == "" ? data["token"] : games[data["code"]]["misc"]["turn"];
    //     console.log(games);

    //     if (games[data["code"]]["round"] < gameRounds) {
    //         let keys = Object.keys(games[data["code"]]);

    //         keys.remove("misc");

    //         let index = keys.indexOf(games[data["code"]]["misc"]["turn"]);

    //         let turnIndex = index == 1 ? 0 : 1;

    //         let turn = keys[turnIndex];

    //         games[data["code"]]["misc"]["turn"] = turn;

    //         io.emit("roll", { "code": data["code"], "data": games[data["code"]], "turn": turn });
    //     } else {
    //         let winner = "";

    //         let keys = Object.keys(games[data["code"]]);
    //         keys.remove("misc");
    //         let arr = [];
    //         let arrSorted = [];
    //         for (let i = 0; i < keys.length; i++) {
    //             arr.push(games[data["code"]][keys[i]]["points"]);
    //             arrSorted.push(games[data["code"]][keys[i]]["points"]);
    //         }

    //         arrSorted.sort(function (a, b) { return b - a });

    //         for (let i = 0; i < keys.length; i++) {
    //             if (arrSorted[0] == games[data["code"]][keys[i]]["points"]) { winner = games[data["code"]][keys[i]]["name"] }
    //         }

    //         if (arr[0] == arr[1]) {
    //             keys.remove("misc");

    //             let index = keys.indexOf(data["token"]);

    //             let turnIndex = index == 1 ? 0 : 1;

    //             let turn = keys[turnIndex];

    //             io.emit("endAgain", { "code": data["code"], "data": games[data["code"]], "turn": turn });
    //             return;
    //         }

    //         io.emit("end", { "code": data["code"], "winner": winner, "data": games[data["code"]] });
    //     }
    // });

    socket.on("roll", (data) => {
        console.log(data)

        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {
                "misc": {
                    "round": 0,
                    "turn": ""
                }
            };
        }
        if (!games[data["code"]].hasOwnProperty("misc")) {
            games[data["code"]]["misc"] = {
                "round": 0,
                "turn": ""
            };
        }
        if (!games[data["code"]].hasOwnProperty(data["token"])) {
            games[data["code"]][data["token"]] = {
                "name": users[data["token"]]["name"],
                "wins": 0,
                "points": 0,
                "prefP": 0
            }
        }

        let rolled = getTwoDice();
        let points = games[data["code"]][data["token"]]["points"] || 0;

        games[data["code"]][data["token"]]["prefP"] = points;

        points += rolled["roll"];
        points = isEven(rolled["roll"]) ? points + 10 : points - 5;
        if (points < 0) {
            points = 0;
        }

        if (rolled["isDouble"]) {
            points += getDice();
            socket.emit("rollDouble", "");
            return;
        }

        console.log(games)

        games[data["code"]][data["token"]]["points"] = points;
        games[data["code"]]["misc"]["round"] = games[data["code"]]["misc"]["round"] == null ? 1 : games[data["code"]]["misc"]["round"] + 1;
        games[data["code"]]["misc"]["turn"] = games[data["code"]]["misc"]["turn"] == "" ? data["token"] : games[data["code"]]["misc"]["turn"];
        console.log(games);

        if (games[data["code"]]["misc"]["round"] < gameRounds) {
            let keys = Object.keys(games[data["code"]]);

            keys.remove("misc");

            let index = keys.indexOf(games[data["code"]]["misc"]["turn"]);

            let turnIndex = index == 1 ? 0 : 1;

            let turn = keys[turnIndex];

            games[data["code"]]["misc"]["turn"] = turn;

            io.emit("roll", { "code": data["code"], "data": games[data["code"]], "turn": turn });
        } else {
            let winner = "";

            let keys = Object.keys(games[data["code"]]);
            keys.remove("misc");
            let arr = [];
            let arrSorted = [];
            for (let i = 0; i < keys.length; i++) {
                arr.push(games[data["code"]][keys[i]]["points"]);
                arrSorted.push(games[data["code"]][keys[i]]["points"]);
            }

            arrSorted.sort(function (a, b) { return b - a });

            for (let i = 0; i < keys.length; i++) {
                if (arrSorted[0] == games[data["code"]][keys[i]]["points"]) {
                    winner = games[data["code"]][keys[i]]["name"];
                    users[keys[i]]["wins"] += 1;
                    saveJSON("users.json", users);
                }
            }

            if (isEven(games[data["code"]]["misc"]["round"]) && arr[0] != arr[1]) {
                io.emit("end", { "code": data["code"], "winner": winner, "data": games[data["code"]] });
            } else {
                keys.remove("misc");

                let index = keys.indexOf(data["token"]);

                let turnIndex = index == 1 ? 0 : 1;

                let turn = keys[turnIndex];

                io.emit("endAgain", { "code": data["code"], "data": games[data["code"]], "turn": turn });
            }
        }


    });
});