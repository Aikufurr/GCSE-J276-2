# GCSE-J276-2

### Dependencies used:
- [body-parser](https://www.npmjs.com/package/body-parser)
- [cookie-parser](https://www.npmjs.com/package/cookie-parser)
- [express](https://expressjs.com/)
- [socket.io](https://socket.io)

### What do they do?
- [body-parser](https://www.npmjs.com/package/body-parser) (server) is used for parsing the body in web requests made to the server, this is used for the login system to get the detains provided in the form.
- [cookie-parser](https://www.npmjs.com/package/cookie-parser) (server) is used for parsing the cookies sent in the web request to the server.
- [express](https://expressjs.com/) (server) is used to host the server that [socket.io](https://socket.io) uses and what the client makes a request to.
- [socket.io](https://socket.io) (server/client) is used for real-time, bidirectional and event-based communication between the client and the server.