var net = require('net');
var chalk = require('chalk');
var Jackpot = require('jackpot');

function DbRelay(host, port, timeout) {
    this.connectionPool = null;
    this.idle = timeout || 1000;
    this.server = {
        host: host,
        port: port
    };
    this.debugMode = false;
    this.debugCmdMode = false;
}

(function (nRelay) {
    var relay = nRelay.prototype;
    var sid = 1;

    relay.connect = function (server, callback) {
        if (!server) server = this.server;
        if (!callback) callback = function () {
        };

        var relay = this;
        if (this.connectionPool) {
            return this.connectionPool.pull(callback);
        }
        var manager = new Jackpot(10);
        manager.factory(function factory() {
            var socket = new net.Socket(),
                Manager = this,
                idleTimeout = function () {
                    relay.debug(chalk.yellow("Connection #" + socket.streamId + " timeout"));
                    Manager.remove(this);
                },
                streamError = function (e) {
                    relay.debug(chalk.red("Socket error: " + e.toString()));
                    Manager.remove(this);
                };

            socket.setNoDelay(true);
            socket.setEncoding('utf8');
            socket.streamId = sid++;
            socket.metaData = {};
            socket.responseBuffer = "";
            socket.bufferArray = [];
            // socket.serverAddress = server;
            // socket.tokens = [].concat(serverTokens);
            socket.relay = relay;

            socket.on('close', function socketClose() {
                relay.debug(chalk.red('Closing #' + socket.streamId));
                Manager.remove(this);
            });
            // socket.on('data', function (data) {
            //     relay.debug('Response ['+socket.streamId+']: "' + data.trim()+'"');
            // });

            socket.on('connect', function streamConnect() {
                // Jackpot handles any pre-connect timeouts by calling back
                // with the error object.
                this.setTimeout(relay.idle, idleTimeout);
                // Jackpot handles any pre-connect errors, but does not handle errors
                // once a connection has been made, nor does Jackpot handle releasing
                // connections if an error occurs post-connect
                relay.debug(chalk.green('connected'));
                this.on('error', streamError);
            });
            socket.on('end', socket.end);

            socket.connect(server.port, server.host);
            relay.debug(chalk.green('connecting #' + socket.streamId + ' to ' + server.host + ':' + server.port));
            return socket;
        });
        manager.on('error', function (err) {
            console.error("[relay] Connection pool error: ", err);
        });
        this.connectionPool = manager;
        this.connectionPool.pull(callback)
    };

    relay.send = function () {
        var self = this;
        var args = Object.values(arguments);
        this.connect(this.server, function (err, socket) {
            var command = args.join(" ");
            self.debugCmd("[" + socket.streamId + "]\t " + chalk.cyan(command));
            socket.write(command + "\r\n");
        });
    };

    relay.debug = function () {
        if (this.debugMode) {
            console.log.apply(console, arguments);
        }
    };
    relay.debugCmd = function () {
        if (this.debugCmdMode) {
            console.log.apply(console, arguments);
        }
    };
})(DbRelay);

module.exports = DbRelay;
