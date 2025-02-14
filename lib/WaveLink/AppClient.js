/**
 * @class StreamDeck
 * StreamDeck object containing all required code to establish
 * communication with SD-Software and the Property Inspector
 */

const EventEmitter = require('events');
const simple_jsonrpc = require('./SimpleJSONRPC');
const WebSocket = require('ws');
const SocketErrors = require('./SocketErrors');

 module.exports = class AppClient {
    static instance;

    minPort     = 0;
    maxPort     = 0;
    currentPort = 0;
    websocket   = null;
    websockets   = new Map();

    isConnected     = false;
    
    connectedToPort = 0;
    appIsRunning    = false;
    tryReconnecting = new Map();

    rpc = new simple_jsonrpc();

    maxConnectionTries = 20;
    connectionTryCounters = new Map();

    debugMode = false;

    EE = new EventEmitter();

    onEvent = this.EE.on;
    emitEvent = this.EE.emit;

    on = this.rpc.on;
    call = this.rpc.call;

    constructor(minPort) {
        if (AppClient.instance)
            return AppClient.instance;

        AppClient.instance = this;

        this.setPort(minPort);

        console.log(this.EE);
    }
    
    setPort(minPort) {
        this.currentPort = minPort;
        this.minPort = minPort;
        this.maxPort = minPort + 9;
    }

    connect() {
        if (!this.currentPort || this.isConnected)
            return;

        logInfo(`AppClient: Start connecting`);
        this.emitEvent("connecting");

        // Start connection to all 10 possible ports
        for (let port = this.minPort; port <= this.maxPort; port++) {
            this.tryToConnect(port);
        }

    }

    tryToConnect(port) {
        logInfo(`AppClient: Trying to connect to port ${port}...`);

        let websocket = this.websockets.get(port);

        if (websocket) {
            if (websocket?.readyState == 1)
                websocket.close();
            websocket = null;
        }

        this.websockets.set(port, new WebSocket(`ws://127.0.0.1:${port}`));
        websocket = this.websockets.get(port);

        websocket.onopen = () => {
            logInfo(`AppClient: Connection established, connected to port ${port}.`);
            this.isConnected = true;
            this.connectedToPort = port;
            this.tryReconnecting.set(port, false);
            this.connectionTryCounters.set(port, 1);

            this.websocket = websocket;
            this.websocket.rpc = this.rpc;
            this.emitEvent("webSocketIsOpen");
        }

        websocket.onclose = async () => {
            if (!this.tryReconnecting.get(port) || this.connectionTryCounters.get(port) > this.maxConnectionTries) {
                logInfo(`AppClient: Connecting to port ${port} closed.`);
            }

            // Check for a closed connection and skip close event form an error to open a connection
            if (this.isConnected && this.connectedToPort == port) {
                console.error("this.isConnected = false")
                this.isConnected = false;
            }

            if (this.appIsRunning) {
                this.tryReconnecting.set(port, true);
                await new Promise(resolve => setTimeout(resolve, 100));

                this.reconnect(port);
            }
        }

        websocket.onerror = () => {
            if (this.connectionTryCounters.get(port) > this.maxConnectionTries)
                logError(`AppClient: Connecting to port failed ${this.maxConnectionTries} times. Last error: ${SocketErrors[websocket.readyState] || 'Unknown error'}`);
        }

        websocket.onmessage = (evt) => {
            if (!evt.data.includes('realTimeChanges')) {
                if (typeof evt.data === 'string') {
                    debug("Incoming Message", JSON.parse(evt.data));
                } else {
                    debug("Incoming Message", typeof evt.data, evt.data);
                }
            }
            this.rpc.messageHandler(evt.data);
        }
    }

    async reconnect(port) {
        if (this.isConnected) {
            this.tryReconnecting.set(port, false);
            this.connectionTryCounters.set(port, 1)
        }

        let counter = this.connectionTryCounters.get(port);

        if (counter == undefined) {
            this.connectionTryCounters.set(port, 1);
            counter = this.connectionTryCounters.get(port);
        }

        if (this.tryReconnecting.get(port) && counter <= this.maxConnectionTries && this.websockets.get(port)?.readyState != 1) {
            //logInfo(`AppClient: Reconnecting to port ${this.currentPort}, try no. ${this.connectionTryCounter}`);
            counter++;
            this.tryToConnect(port);
        } else {
            counter = 1;
        }
    }

    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;

            this.tryReconnecting.forEach( value => { value = false; } );
            this.emitEvent("webSocketIsClosed");
        }

        this.connectionTryCounter = 1;
    }

    initRPC() {
        this.rpc.toStream = (msg) => {
            try {
                debug("Sending: " + msg);
                this.websocket.send(msg);
            } catch (error) {
                debug("ERROR:", error);
            }
        };
    }

    onConnecting(fn) {
        // this.onEvent("connecting", () => fn());
    }

    onConnection(fn) {
        this.initRPC();
        this.onEvent("webSocketIsOpen", () => fn());
    }

    onDisconnection(fn) {
        // this.onEvent("webSocketIsClosed", () => fn());
    }
}