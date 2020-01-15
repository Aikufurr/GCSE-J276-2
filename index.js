const express = require('express'); // For creating a web server
const app = express(); // Creats the router to allow access to the web socket and paths
const port = 5001; // Port to host web server on
const bodyParser = require('body-parser') // For parsing the body in the form post data
const cookieParser = require('cookie-parser') // For parsing cookies in web requests
const fs = require("fs"); // Allows for writing/reading files
const path = require('path'); // For getting full paths
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));
app.use(cookieParser()); // Allows access to cookies
app.use('/resources', express.static(__dirname + '/views/resources')); // When a client requests a file in /resources/* it will display the file

var server = app.listen(port, () => console.log(`app listening on port ${port}!`)) // Creates the server and stores it in a var

const io = require("socket.io")(server) // Allows for the use of web sockets

const gameRounds = 10; // Rounds of game * 2 so each player has to roll for it to count as one round, clients floor the halfed value (see game.html)


// Remove from an array by value
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

// Create blank objects for later reference
var users = {};

var games = {};

function readJSON(file) {
    return JSON.parse(fs.readFileSync(`./${file}`, `utf8`));
}

function saveJSON(file, data) {
    fs.writeFileSync(`./${file}`, JSON.stringify(data));
}

// If the json exists on disk, read the file and parse the text to an object and set the users object to it
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

// Used to simulate rolling a single Die
function getDice() {
    var letters = '123456';
    var roll = 0;

    let letter = letters[Math.floor(Math.random() * letters.length)];

    roll = parseInt(letter);
    return { "roll": roll, "isDouble": false, "rolls": [parseInt(letter)] };
}

// Used to simulate rolling a pair of Die and pass if they were the same
function getTwoDice() {
    let letters = '123456';
    let first = letters[Math.floor(Math.random() * letters.length)];
    let second = letters[Math.floor(Math.random() * letters.length)];
    let isDouble = false;

    if (first == second) {
        isDouble = true;
    }

    let roll = parseInt(first) + parseInt(second);
    return { "roll": roll, "isDouble": isDouble, "rolls": [parseInt(first), parseInt(second)] };
}

function isEven(n) {
    return n % 2 == 0;
}

function isOdd(n) {
    return Math.abs(n % 2) == 1;
}

// The main GET, if the parms are just / it will send the index file
app.get('/:room?', (req, res) => {
    if (req.params.room == null) {
        // res.redirect("/" + getRandomCode());
        res.sendFile(path.join(__dirname, 'views/index.html'));
        return;
    }
    // If the user has a token in their cookies, meaning they are already signed in, send the contents of the game html
    if (req.cookies["token"]) {
        res.sendFile(path.join(__dirname, 'views/game.html'))
    } else {
        // else send the contents of the login form
        res.sendFile(path.join(__dirname, 'views/login.html'));
    }
});


// When the user submits the login form
app.post("/login", (req, res) => {
    var keys = Object.keys(users); // Get the keys for the users object
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if ((users[key]["name"] === req.body["uname"]) && (users[key]["psk"] === req.body["psw"])) { // If the passed username/psk matches any in the object
            // Set a cookie with the user's UUID
            res.cookie('token', key, {
                httpOnly: false
            })
            // Redirect them to the room code
            res.redirect(`/${req.body["code"]}`)
            return;
        }
    }
    res.redirect(`/${req.body["code"]}`)
})

// When a new client connects to the web socket
io.sockets.on('connection', (socket) => {
    console.log("We have a new client: " + socket.id); // Log their ID

    //
    // io.emit = Emit to all connected clients
    // socket.emit = Emit to the client who called
    //

    // Return the list of current games and the leaderboard
    socket.on("index", (_) => {

        let usersList = Object.keys(users);

        let wins = {}

        for (let i = 0; i < usersList.length; i++) {
            wins[users[usersList[i]]["name"]] = users[usersList[i]]["wins"]
        }

        socket.emit("index", { "games": games, "leaderboard": wins });
    });

    // Called when a user reloads or enters a room, returns the current state
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

    // When a user clicks the start button
    socket.on("start", (data) => {
        // If a game reset was passes
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

        // If the current turn is blank, set it to the passed user's token or else just use the current turn
        games[data["code"]]["misc"]["turn"] = games[data["code"]]["misc"]["turn"] == "" ? data["token"] : games[data["code"]]["misc"]["turn"];


        if (keys.length != 2) {
            socket.emit("start", { "error": "not-full" });
        } else {
            io.emit("start", { "code": data["code"], "data": games[data["code"]] });
        }
    });

    // When user clicks the join/leave button
    socket.on("userUpdateEvent", (data) => {
        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {};
        }

        // If they clicked join
        if (data["type"] == "join") {
            let keys = Object.keys(games[data["code"]]);
            keys.remove("misc");

            // If the game is full
            if (keys.length > 1) {
                socket.emit("userUpdateEvent", { "error": "full" });
            } else {
                // Else add the user to the game
                if (!games[data["code"]].hasOwnProperty(data["token"])) {
                    games[data["code"]][data["token"]] = {
                        "name": users[data["token"]]["name"],
                        "points": 0
                    }
                }
                io.emit("userUpdateEvent", { "code": data["code"], "data": games[data["code"]] });
            }
        } else if (data["type"] == "leave") {
            // Else if it was a leave

            // Delete their data from the current game
            delete games[data["code"]][data["token"]]
            let keys = Object.keys(games[data["code"]]);
            keys.remove("misc");

            // If the game is left with only one user, reset the round to 0
            if (keys.length == 1) {
                games[data["code"]]["misc"]["round"] = 0;
            }

            // If the game gets left with 0 users, delete the game from games
            if (keys.length == 0) {
                delete games[data["code"]];
                io.emit("userUpdateEvent", { "code": data["code"], "data": {} });
            } else {
                io.emit("userUpdateEvent", { "code": data["code"], "data": games[data["code"]] });
            }

        }
    });

    // When a user clicks the "Roll button
    socket.on("roll", (data) => {

        // If the games object does not have the room in it, add it
        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {
                "misc": {
                    "round": 0,
                    "turn": ""
                }
            };
        }
        // If the game doesn't have the misc object, add it
        if (!games[data["code"]].hasOwnProperty("misc")) {
            games[data["code"]]["misc"] = {
                "round": 0,
                "turn": ""
            };
        }
        // If the game doesn't have the user, add it
        if (!games[data["code"]].hasOwnProperty(data["token"])) {
            games[data["code"]][data["token"]] = {
                "name": users[data["token"]]["name"],
                "points": 0
            }
        }

        // Create a placeholder
        let rolled = {};

        if (data["func"] == "double") {
            // Roll the two Die
            rolled = getTwoDice();
        } else {
            // Roll a single Die
            rolled = getDice();
        }

        // Get the user's current points or else just 0
        let points = games[data["code"]][data["token"]]["points"] || 0;

        // Add the rolled score to their points
        points += rolled["roll"];

        // If the roll was even, add 10, else remove 5
        points = isEven(rolled["roll"]) ? points + 10 : points - 5;

        // If their score goes below 0, set it to 0
        if (points < 0) {
            points = 0;
        }

        console.log(rolled)

        // If they rolled a double, alert the user they need to roll again
        if (rolled["isDouble"]) {
            io.emit("rollDouble", { "code": data["code"], "roller": data["token"], "roll": rolled, "data": games[data["code"]] });
            return;
        }

        // Set the user's points to the rolled points
        games[data["code"]][data["token"]]["points"] = points;

        // If the round is undefined, set it to 1, else set it to itself + 1
        games[data["code"]]["misc"]["round"] = games[data["code"]]["misc"]["round"] == null ? 1 : games[data["code"]]["misc"]["round"] + 1;

        // If the current turn is blank, set it to the passed user's token or else just use the current turn
        games[data["code"]]["misc"]["turn"] = games[data["code"]]["misc"]["turn"] == "" ? data["token"] : games[data["code"]]["misc"]["turn"];

        // If the current round is less then the gameRounds
        if (games[data["code"]]["misc"]["round"] < gameRounds) {
            let keys = Object.keys(games[data["code"]]);

            keys.remove("misc");

            // Get the index of the turn-uuid in the array of users in the game
            let index = keys.indexOf(games[data["code"]]["misc"]["turn"]);

            // If they are at index 1, set the turnIndex to 0, else 1
            let turnIndex = index == 1 ? 0 : 1;

            // Set the turn to the new uuid
            let turn = keys[turnIndex];

            games[data["code"]]["misc"]["turn"] = turn;

            io.emit("roll", { "code": data["code"], "roller": data["token"], "roll": rolled, "data": games[data["code"]], "turn": turn });
        } else {
            let winner = "";

            let keys = Object.keys(games[data["code"]]);
            keys.remove("misc");
            let arr = [];
            let arrSorted = [];

            // Add all the user's points to an array
            for (let i = 0; i < keys.length; i++) {
                arr.push(games[data["code"]][keys[i]]["points"]);
                arrSorted.push(games[data["code"]][keys[i]]["points"]);
            }

            // Sort the array from highest to lowest
            arrSorted.sort(function (a, b) { return b - a });

            // Loop through each user in the game and if their score matches the 0th index of the sorted array declare them the winner--
            //    --and increase their wins by 1, then save to the json file
            for (let i = 0; i < keys.length; i++) {
                if (arrSorted[0] == games[data["code"]][keys[i]]["points"]) {
                    winner = games[data["code"]][keys[i]]["name"];
                    users[keys[i]]["wins"] += 1;
                    saveJSON("users.json", users);
                }
            }

            // If the round is an even number, meaning both users have had a roll, and their scores are not the same, send the winner
            if (isEven(games[data["code"]]["misc"]["round"]) && arr[0] != arr[1]) {
                io.emit("end", { "code": data["code"], "winner": winner, "data": games[data["code"]] });
            } else {
                // Send the fact that their scores are the same and swap the turns
                keys.remove("misc");

                let index = keys.indexOf(data["token"]);

                let turnIndex = index == 1 ? 0 : 1;

                let turn = keys[turnIndex];

                io.emit("endAgain", { "code": data["code"], "roller": data["token"], "roll": rolled, "data": games[data["code"]], "turn": turn });
            }
        }
    });
});