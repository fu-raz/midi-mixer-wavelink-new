// Include plugin requirements
const { Assignment, ButtonType } = require("midi-mixer-plugin");
const WaveLinkClient = require("./WaveLink/WaveLinkClient");

module.exports = class Controller
{
    assignments = {};

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
        
        console.log('Registering event:', kJSONPropertySelectedOutputChanged);
        this.WaveLink.onEvent(kJSONPropertySelectedOutputChanged, this.outputChanged.bind(this));

        console.log('Registering event:', kJSONPropertyInputsChanged);
        this.WaveLink.onEvent(kJSONPropertyInputsChanged, this.inputsChanged.bind(this));

        console.log('Registering on volume changed event', kJSONPropertyInputVolumeChanged);
        this.WaveLink.onEvent(kJSONPropertyInputVolumeChanged, this.inputChanged.bind(this));

        console.log('Registering on mute changed event', kJSONPropertyInputMuteChanged);
        this.WaveLink.onEvent(kJSONPropertyInputMuteChanged, this.inputChanged.bind(this));
    }

    initWaveLink()
    {
        this.WaveLink.init();
        this.WaveLink.connect();
    }

    outputChanged()
    {
        console.log('Outputs changed');
        console.log(this.WaveLink.outputs);
    }

    inputsChanged()
    {
        console.log('Inputs changed');
        console.log(this.WaveLink.inputs);

        this.WaveLink.inputs.forEach((input) => {
            if (!this.assignments[input.identifier])
            {
                if (input.isAvailable)
                {
                    this.createMixer(input, kPropertyMixerIDLocal);
                    this.createMixer(input, kPropertyMixerIDStream);

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
            }
        } else if (inputData.mixerID == kPropertyMixerIDStream)
        {
            let mixerAssignment = this.getMixerAssignment(`${inputData.identifier}_stream`);
            if (mixerAssignment)
            {
                mixerAssignment.volume = input.stream.volume / 100;
                mixerAssignment.muted = input.stream.isMuted;
            }
        }
    }

    getMixerAssignment(identifier)
    {
        if (this.assignments[identifier])
        {
            return this.assignments[identifier];
        }

        return false;
    }

    createMixer(input, mixerID)
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

        this.assignments[`${input.identifier}_${extension}`] = mixerAssignment;
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