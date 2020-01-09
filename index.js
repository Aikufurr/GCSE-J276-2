const express = require('express');
const app = express();
const port = 5001;
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));
app.use(cookieParser()); // Allows access to cookies

var server = app.listen(port, () => console.log(`app listening on port ${port}!`))

const io = require("socket.io")(server)


var users = {
    "48245ea3-c240-45ce-baa3-5ce0a1105a4d": {
        "name": "kade",
        "psk": "nintendo"

    }, "904001c1-0f51-4c3a-a1ab-4ecaaafcf05f": {
        "name": "nicole",
        "psk": "carrot"

    }
};

var games = {
    "5N9GZO": {}
};


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
        res.redirect("/" + getRandomCode());
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

    socket.on("init", (data) => {
        if (data["token"] == "") {
            socket.emit("init", "login");
        } else {
            socket.emit("init", "game");
        }
    })

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
        delete games[data["code"]];
        io.emit("start", { "code": data["code"], "success": true });
    });

    socket.on("roll", (data) => {
        console.log(data)

        if (!games.hasOwnProperty(data["code"])) {
            games[data["code"]] = {};
        }
        if (!games[data["code"]].hasOwnProperty(data["token"])) {
            games[data["code"]][data["token"]] = {
                "name": users[data["token"]]["name"],
                "wins": 0,
                "points": 0
            }
        }
        let rolled = getTwoDice();
        let points = games[data["code"]][data["token"]]["points"];

        points += rolled["roll"];
        points = isEven(rolled["roll"]) ? points + 10 : points - 5;
        if (points < 0) {
            points = 0;
        }

        if (rolled["isDouble"]) {
            //TODO MANUAL ROLL
            points += getDice();
        }

        games[data["code"]][data["token"]]["points"] = points;
        games[data["code"]]["round"] = games[data["code"]]["round"] == null ? 1 : games[data["code"]]["round"] + 1;
        console.log(games);

        if (games[data["code"]]["round"] < 6) {
            io.emit("roll", { "code": data["code"], "data": games[data["code"]] });
        } else {
            let winner = "";

            let keys = Object.keys(games[data["code"]]);
            let arr = [];
            for (let i = 0; i < keys.length; i++) {
                if (keys[i] != "round") {
                    arr.push(games[data["code"]][keys[i]]["points"])
                }
            }
            arr.sort(function (a, b) { return b - a })

            for (let i = 0; i < keys.length; i++) {
                if (keys[i] != "round") {
                    if (arr[0] == games[data["code"]][keys[i]]["points"]) { winner = games[data["code"]][keys[i]]["name"] }
                }
            }

            io.emit("end", { "code": data["code"], "winner": winner, "data": games[data["code"]] });
        }


    });
});