// Include plugin requirements
const { Assignment, ButtonType } = require("midi-mixer-plugin");
const WaveLinkClient = require("./WaveLink/WaveLinkClient");

module.exports = class Controller
{
    mixers = {};
    mixMonitor = {};
    mixStream = {};
    activeTimeout = 0;

    isConnected = false;
    reconnectionTimeout = 0;

    constructor()
    {
        // Create new WaveLink instance
        this.WaveLink = new WaveLinkClient();

        // Set application properties
        global.kJSONPropertyInterfaceRevision = 2;
        global.kJSONPropertyAppName = "MIDI Mixer WaveXLR";

        this.setupEvents();
        this.initWaveLink();
    }

    setupEvents()
    {
        console.log('Registering connection event');
        this.WaveLink.onConnection(this.connected.bind(this));

        console.log('Registering event:', kJSONPropertyInputsChanged);
        this.WaveLink.onEvent(kJSONPropertyInputsChanged, this.inputsChanged.bind(this));

        console.log('Registering on volume changed event', kJSONPropertyInputVolumeChanged);
        this.WaveLink.onEvent(kJSONPropertyInputVolumeChanged, this.inputChanged.bind(this));

        console.log('Registering on mute changed event', kJSONPropertyInputMuteChanged);
        this.WaveLink.onEvent(kJSONPropertyInputMuteChanged, this.inputChanged.bind(this));

        console.log('Registering name change event', kJSONPropertyInputNameChanged);
        this.WaveLink.onEvent(kJSONPropertyInputNameChanged, this.inputChanged.bind(this));

        console.log('Registering output change event', kPropertyOutputChanged);
        this.WaveLink.onEvent(kPropertyOutputChanged, this.outputChanged.bind(this));

        console.log('Registering output volume change event', kJSONPropertyOutputVolumeChanged);
        this.WaveLink.onEvent(kJSONPropertyOutputVolumeChanged, this.outputLevelsChanged.bind(this));

        console.log('Registering output mute change event', kJSONPropertyOutputMuteChanged);
        this.WaveLink.onEvent(kJSONPropertyOutputMuteChanged, this.outputMuteChanged.bind(this));

        console.log('Registering disconnect event');
        this.WaveLink.onEvent('webSocketIsDisconnected', this.disconnected.bind(this));
    }

    connected()
    {
        console.log('connected');
        this.isConnected = true;
        clearTimeout(this.reconnectionTimeout);
    }

    disconnected()
    {
        console.log('Disconnected, trying to reconnect');
        this.isConnected = false;
        this.tryConnect();
    }

    tryConnect()
    {
        console.log('Trying to connect');
        this.WaveLink.connectionTryCounter = 0;
        this.WaveLink.reconnect();
        this.reconnectionTimeout = setTimeout(this.tryConnect.bind(this), 300000);
    }

    initWaveLink()
    {
        this.WaveLink.init();
        this.tryConnect();
    }

    outputsChanged()
    {
        console.log('Outputs changed');
        console.log(this.WaveLink.outputs);
    }

    outputChanged()
    {
        if (this.WaveLink.output)
        {
            console.log('Got output data', this.WaveLink.output);
            // Output is known
            // Create the Monitor Mix and Stream Mix mixers
            let outputDataLocal = this.WaveLink.output.local;
            outputDataLocal.name = 'Mix Monitor';
            this.mixMonitor = this.createOutputMixer(outputDataLocal, kPropertyMixerIDLocal);

            let outputDataStream = this.WaveLink.output.stream;
            outputDataStream.name = 'Mix Stream';
            this.mixStream = this.createOutputMixer(outputDataStream, kPropertyMixerIDStream);
        }
    }

    outputMuteChanged(mixerId)
    {
        // Apparently the mute change doesn't send an object but a mixerID string
        switch(mixerId)
        {
            case kPropertyMixerIDLocal:
                this.mixMonitor.muted = this.WaveLink.output.local.isMuted;
                break;
            case kPropertyMixerIDStream:
                this.mixStream.muted = this.WaveLink.output.stream.isMuted;
                break;
        }
    }

    outputLevelsChanged(outputData)
    {
        // Throttled when doing the level changing via mixer
        if (!this.activeTimeout)
        {
            switch(outputData.mixerID)
            {
                case kPropertyMixerIDLocal:
                    console.log('Setting volume to', this.WaveLink.output.local.volume);
                    this.mixMonitor.volume = this.WaveLink.output.local.volume / 100;
                    break;
                case kPropertyMixerIDStream:
                    this.mixStream.volume = this.WaveLink.output.stream.volume / 100;
                    break;
            }
        }
    }

    inputsChanged()
    {
        console.log('Inputs changed');
        console.log(this.WaveLink.inputs);

        this.WaveLink.inputs.forEach((input) => {
            if (!this.mixers[input.identifier])
            {
                if (input.isAvailable)
                {
                    this.createInputMixer(input, kPropertyMixerIDLocal);
                    this.createInputMixer(input, kPropertyMixerIDStream);

                    this.createLinkButton(input);
                }
            } else
            {
                if (!input.isAvailable)
                {
                    this.deleteMixer(input.identifier);
                }
            }
        });
    }

    inputChanged(inputData)
    {
        let input = this.WaveLink.getInput(inputData.identifier);

        if (inputData.mixerID == kPropertyMixerIDLocal)
        {
            let mixerAssignment = this.getMixerAssignment(`${inputData.identifier}_monitor`);
            if (mixerAssignment)
            {
                mixerAssignment.volume = input.local.volume / 100;
                mixerAssignment.muted = input.local.isMuted;
                mixerAssignment.name = `WaveLink: ${input.name} monitor`;
            }
        } else if (inputData.mixerID == kPropertyMixerIDStream)
        {
            let mixerAssignment = this.getMixerAssignment(`${inputData.identifier}_stream`);
            if (mixerAssignment)
            {
                mixerAssignment.volume = input.stream.volume / 100;
                mixerAssignment.muted = input.stream.isMuted;
                mixerAssignment.name = `WaveLink: ${input.name} stream`;
            }
        }
    }

    getMixerAssignment(identifier)
    {
        if (this.mixers[identifier])
        {
            return this.mixers[identifier];
        }

        return false;
    }

    createOutputMixer(output, mixerID)
    {
        let id = `wavelink.output.${mixerID}`;
        let mixerAssignment = new Assignment(id, {name: `WaveLink: ${output.name}`, muted: output.isMuted, volume: output.volume / 100});
        mixerAssignment.throttle = 50;

        mixerAssignment.on('volumeChanged', (level) => {
            // Unlike the inputs, we can't rely on getting a fast outputVolumeChanged event, so we're setting the new volume here
            mixerAssignment.volume = level;

            // Change the WaveLink volume
            this.WaveLink.setOutputConfig(
                `${id}_volume_change`,
                kPropertyOutputLevel,
                false,
                mixerID,
                Math.round(level * 100)
            );

            // Setting timeout to throttle output volume events
            clearTimeout(this.activeTimeout);
            this.activeTimeout = setTimeout(() => {
                this.activeTimeout = 0;
            }, 100);
        });

        mixerAssignment.on('mutePressed', () => {
            this.WaveLink.setOutputConfig(
                `${id}_mute_change`,
                kPropertyOutputMute,
                false,
                mixerID,
                !mixerAssignment.muted
            );
        });

        return mixerAssignment;
    }

    createInputMixer(input, mixerID)
    {
        let extension = '';
        let isMuted = false;
        let volume = 100;

        if (mixerID == kPropertyMixerIDLocal)
        {
            extension = 'monitor';
            isMuted = input.local.isMuted;
            volume = input.local.volume;
        } else if (mixerID == kPropertyMixerIDStream)
        {
            extension = 'stream';
            isMuted = input.stream.isMuted;
            volume = input.stream.volume;
        }

        // Create assignment
        let mixerAssignment = new Assignment(`${input.identifier}_${extension}`, {name: `WaveLink: ${input.name} ${extension}`, muted: isMuted, volume: volume / 100});
        mixerAssignment.throttle = 50;

        mixerAssignment.on('volumeChanged', (level) => {

            // Change the WaveLink volume
            this.WaveLink.setInputConfig(
                `${input.identifier}_${extension}_volume_change`,
                kPropertyVolume,
                false,
                input.identifier,
                mixerID,
                Math.round(level * 100)
            );
        });

        mixerAssignment.on('mutePressed', () => {
            // Change the mute state in wavelink
            this.WaveLink.setInputConfig(
                `${input.identifier}_${extension}_mute_change`,
                kPropertyMute,
                false,
                input.identifier,
                mixerID,
                !mixerAssignment.muted
            );
        });

        this.mixers[`${input.identifier}_${extension}`] = mixerAssignment;
    }

    createLinkButton(input)
    {
        // Create link button
        let linkButton = new ButtonType(`${input.identifier}_link_button`, {
            name: `Link ${input.name} monitor and stream`
        });

        linkButton.on('pressed', () => {
            if (linkButton.active)
            {
                console.log('Trying to unlink')
                linkButton.active = false;
            } else
            {
                console.log('Trying to link');
                linkButton.active = true;
            }
        });
    }

    deleteMixer(identifier)
    {

    }
}

// $MM.getSettings().then((settings) => {
//     console.log("Current settings:", settings);
// });

// const WaveXLRPlugin = new midi_mixer_plugin.Assignment("wavexlr-furaz", {
//     name: "FuRaz WaveXLR Plugin",
// });