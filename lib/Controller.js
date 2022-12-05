// Include plugin requirements
const { Assignment, ButtonType } = require("midi-mixer-plugin");
const WaveLinkClient = require("./WaveLink/WaveLinkClient");

module.exports = class Controller
{
    mixers = new Map();
    mixMonitor = {};
    mixStream = {};
    activeTimeout = 0;
    
    outputSelected = null;
    outputDevices = new Map();
    outputDeviceButtons = new Map();
    
    outputRotation = new Map();
    outputRotationCurrentIndex = 0;
    outputRotationButton = {};

    microphones = new Map();

    soloSnapshot = new Map();
    soloButtons = new Map();
    soloEnabled = false;

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

        console.log('Registering event inputs changed', kJSONPropertyInputsChanged);
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

        console.log('Registering outputs changed event');
        this.WaveLink.onEvent(kJSONPropertySelectedOutputChanged, this.outputsChanged.bind(this));

        console.log('Registering microphone config event', kJSONPropertyGetMicrophoneConfig);
        this.WaveLink.onEvent(kJSONPropertyGetMicrophoneConfig, this.microphonesFetched.bind(this));
    }

    connected()
    {
        console.log('connected');
        this.isConnected = true;
        clearTimeout(this.reconnectionTimeout);
        $MM.setSettingsStatus('connectionStatus', 'Connected');
    }

    disconnected()
    {
        console.log('Disconnected, trying to reconnect');
        this.isConnected = false;
        $MM.setSettingsStatus('connectionStatus', 'Reconnecting');
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
        $MM.setSettingsStatus('connectionStatus', 'Connecting');
        this.tryConnect();
    }

    microphonesFetched()
    {
        if (this.WaveLink.microphones)
        {
            if (this.WaveLink.microphones.length > 0)
            {
    
                this.WaveLink.microphones.forEach(microphoneSettings => {
                    if (!this.microphones.has(microphoneSettings.identifier))
                    {
                        // Let's create a new mixer and button
                        console.log('Found microphone', microphoneSettings);
                    }
                });
            }
        }
    }

    outputsChanged()
    {
        console.log('Outputs changed');
        console.log(this.WaveLink.outputs);
        if (this.WaveLink.outputs)
        {
            // Get the current settings
            $MM.getSettings().then((mmSettings) => {
                // We got the current settings
                console.log('Settings', mmSettings);

                // First set the amount of output devices in the settings tab
                $MM.setSettingsStatus('outputDevicesCount', this.WaveLink.outputs.length);

                // Reset the current output devices
                // TODO: Maybe check if we have to unset buttons in stead of doing this
                this.outputDevices = new Map();

                // Loop from 0 to 9 to add the device names to the settings tab and save the devices to outputDevices also create buttons if enabled
                for (let i = 0; i <= 9; i++)
                {
                    if (i < this.WaveLink.outputs.length)
                    {
                        let output = this.WaveLink.outputs[i];
                        // TODO: Maybe a little less confusing and not name it active, since its only used in rotation?
                        let outputDeviceObject = {name: output.name, identifier: output.identifier, index: i, active: false};
                        this.outputDevices.set(output.identifier, outputDeviceObject);
                        $MM.setSettingsStatus(`outputDevice${i}`, output.name);
    
                        if (mmSettings[`outputDevice${i}Enabled`] === true)
                        {
                            // Create button for switching to this device directly
                            let outputDeviceButton = new ButtonType(`${output.identifier}_switch_to_device_button`, {
                                name: `Switch monitor output to ${output.name}`
                            });

                            outputDeviceButton.on('pressed', () => {
                                if (!outputDeviceButton.active)
                                {
                                    // Set the device active in WaveLink
                                    console.log('Setting selected device in WaveLink');
                                    this.WaveLink.setSelectedOutput(output.identifier);
                                } else
                                {
                                    console.log('Trying to enable an already active output device');
                                }
                            });

                            this.outputDeviceButtons.set(output.identifier, outputDeviceButton);

                            // Add this device to the device rotation
                            this.outputRotation.set(output.identifier, outputDeviceObject);
                        }
                        
                    }
                }
    
                if (this.WaveLink.selectedOutput)
                {
                    console.log('Selected output', this.WaveLink.selectedOutput);
                    if (this.outputDevices.has(this.WaveLink.selectedOutput) && this.WaveLink.outputs)
                    {
                        this.selectOutputDevice(this.WaveLink.selectedOutput);
                    }
                }

                // If we have more than one device in rotation, we should create the rotation button
                if (this.outputRotation.size > 1)
                {
                    this.outputRotationButton = new ButtonType('wavelink_output_device_rotation_button', {
                        name: 'Switch WaveLink Monitormix output device',
                        active: true
                    });

                    this.outputRotationButton.on('pressed', this.rotateOutputDevice.bind(this));

                    // Set the currently selected device as active
                    if (this.outputRotation.has(this.WaveLink.selectedOutput))
                    {
                        // Because we just set this map, we can assume there are no active outputs and just activate the current one
                        this.outputRotation.get(this.WaveLink.selectedOutput).active = true;
                    }
                    console.log('Output rotation map', this.outputRotation);
                } else
                {
                    console.log(`Output rotation map only contains ${this.outputRotation.size} items`);
                }
            });
            
        }
    }

    rotateOutputDevice()
    {
        let outputRotationKeys = Array.from(this.outputRotation.keys());
        console.log('OutputRotationKeys', outputRotationKeys);

        for (let i = 0; i < this.outputRotation.size; i++)
        {
            console.log(`Trying to find rotation device ${i}`);

            let rotateDevice = this.outputRotation.get(outputRotationKeys[i]);
            if (undefined !== rotateDevice && rotateDevice.active)
            {
                console.log(`Currently active device is ${rotateDevice.name}`);
                rotateDevice.active = false;

                let newActiveIndex = (i + 1 + this.outputRotation.size) % this.outputRotation.size;
                console.log(`Active index was: ${i} and is now ${newActiveIndex}`);

                let newActiveDevice = this.outputRotation.get(outputRotationKeys[newActiveIndex]);
                this.WaveLink.setSelectedOutput(newActiveDevice.identifier);

                break;
            }
        }
    }

    selectOutputDevice(outputIdentifier)
    {
        // Disable button if output device is not the current one
        if (this.outputSelected)
        {
            if (this.outputSelected.identifier !== outputIdentifier && this.outputDeviceButtons.has(this.outputSelected.identifier))
            {
                console.log(`Disable currently selected button for ${this.outputSelected.name}`);
                let outputSelectedButton = this.outputDeviceButtons.get(this.outputSelected.identifier);
                outputSelectedButton.active = false;

                // Unactivate the current output
                if (this.outputDevices.has(this.outputSelected.identifier))
                {
                    this.outputDevices.get(this.outputSelected.identifier).active = false;
                }
            }
        }

        // Find the new device
        let newOutputDevice = this.outputDevices.get(outputIdentifier);
        newOutputDevice.active = true;
        console.log(`Setting output device to ${newOutputDevice.name}`);
        this.outputSelected = newOutputDevice;

        // Set label for selected device
        $MM.setSettingsStatus(`outputDeviceSelected`, newOutputDevice.name);

        // Enabling the button if there is one
        if (this.outputDeviceButtons.has(this.outputSelected.identifier))
        {
            console.log(`Enable button for ${newOutputDevice.name}`);
            let outputSelectedButton = this.outputDeviceButtons.get(this.outputSelected.identifier);
            outputSelectedButton.active = true;
        }
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

        let newIds = new Map();

        this.WaveLink.inputs.forEach((input) => {
            // Add to the new ids list so we can compare for deletion
            if (input.isAvailable) newIds.set(input.identifier, true);
            
            // Create or delete mixer when needed
            if (!this.mixers.has(input.identifier))
            {
                if (input.isAvailable)
                {
                    this.createInputMixer(input, kPropertyMixerIDLocal);
                    this.createInputMixer(input, kPropertyMixerIDStream);

                    // this.createLinkButton(input);
                    this.createSoloButton(input);
                }
            } else
            {
                if (!input.isAvailable)
                {
                    this.deleteMixer(input.identifier);
                }
            }
        });

        // Loop through all inputs to see if it's still available and delete otherwise
        for (const [identifier_local_stream, mixer] of this.mixers)
        {
            let identifier = identifier_local_stream.replace(/(_monitor)|(_stream)/, '');

            if (!newIds.has(identifier))
            {
                console.log(`Mixer with id ${identifier} is no longer found. Deleting`);
                this.deleteMixer(identifier);
            }
        }
    }

    restoreSoloSnapshot()
    {
        // Reset 
        for (const [identifier, muted] of this.soloSnapshot)
        {
            this.WaveLink.setInputConfig(
                `${identifier}_local_solo_mute_change`,
                kPropertyMute,
                false,
                identifier,
                kPropertyMixerIDLocal,
                muted.local
            );
            this.WaveLink.setInputConfig(
                `${identifier}_stream_solo_mute_change`,
                kPropertyMute,
                false,
                identifier,
                kPropertyMixerIDStream,
                muted.stream
            );
        }

        this.soloEnabled = false;
    }

    createSoloButton(input)
    {
        let soloButton = new ButtonType(`${input.identifier}_solo_button`, {
            name: `Solo WaveLink input: ${input.name}`,
            active: false
        });

        soloButton.on('pressed', () => {
            if (input.solo === true)
            {
                console.log(`${input.name} is no longer soloing and mute snapshot is being restored`);

                // Stop flashing of button led
                clearInterval(this.soloInterval);

                // Enable solo button led
                soloButton.active = false;

                // No longer solo
                input.solo = false;

                // Restore the snapshot
                this.restoreSoloSnapshot();
            } else
            {
                console.log(`${input.name} is now soloing`);
                if (this.soloInterval)
                {
                    // Stop flashing of button led
                    clearInterval(this.soloInterval);
                }
                
                // Enable flashing of button led
                this.soloInterval = setInterval(() => { soloButton.active = !soloButton.active; }, 500);

                // Create muted snapshot if solo enabled
                if (!this.soloEnabled)
                {
                    console.log('Theres no other device in solo mode, so make a snapshot');

                    this.soloSnapshot = new Map();
                    this.WaveLink.inputs.forEach((wavelinkInput) => {
                        this.soloSnapshot.set(wavelinkInput.identifier, {local: wavelinkInput.local.isMuted, stream: wavelinkInput.stream.isMuted});
                    });
                } else
                {
                    this.restoreSoloSnapshot();
                }

                // Mute if not the selected input
                this.WaveLink.inputs.forEach((wavelinkInput) => {
                    if (wavelinkInput.identifier !== input.identifier)
                    {
                        // Mute monitor if not already muted
                        if (!wavelinkInput.local.isMuted)
                        {
                            this.WaveLink.setInputConfig(
                                `${wavelinkInput.identifier}_local_solo_mute_change`,
                                kPropertyMute,
                                false,
                                wavelinkInput.identifier,
                                kPropertyMixerIDLocal,
                                true
                            );
                        }

                        // Mute stream channel if not already muted
                        if (!wavelinkInput.stream.isMuted)
                        {
                            this.WaveLink.setInputConfig(
                                `${wavelinkInput.identifier}_stream_solo_mute_change`,
                                kPropertyMute,
                                false,
                                wavelinkInput.identifier,
                                kPropertyMixerIDStream,
                                true
                            );
                        }
                    }
                });

                // Set solo of current input to true
                input.solo = true;

                // Set solo globally
                this.soloEnabled = true;

                // Unmute selected input
                this.WaveLink.setInputConfig(
                    `${input.identifier}_local_solo_mute_change`,
                    kPropertyMute,
                    false,
                    input.identifier,
                    kPropertyMixerIDLocal,
                    false
                );
                this.WaveLink.setInputConfig(
                    `${input.identifier}_stream_solo_mute_change`,
                    kPropertyMute,
                    false,
                    input.identifier,
                    kPropertyMixerIDStream,
                    false
                );
            }
        });

        this.soloButtons.set(input.identifier, soloButton);
    }

    inputChanged(inputData)
    {
        // Throttled when doing the level changing via mixer
        if (!this.activeTimeout)
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
    }

    getMixerAssignment(identifier)
    {
        if (this.mixers.has(identifier))
        {
            return this.mixers.get(identifier);
        }

        return false;
    }

    createMicrophoneMixer(microphone)
    {
        let id = `wavelink.microphone.${microphone.identifier}`;
        let mixerAssignment = new Assignment(id, {name: `Microphone gain: ${microphone.name}`, muted: false, volume: 1});
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
        let mixerAssignment = new Assignment(
            `${input.identifier}_${extension}`,
            {
                name: `WaveLink: ${input.name} ${extension}`,
                muted: isMuted,
                volume: volume / 100
            }
        );
        mixerAssignment.throttle = 50;

        mixerAssignment.on('volumeChanged', (level) => {
            // Unlike I previously thought, this is also needed here
            mixerAssignment.volume = level;

            // Change the WaveLink volume
            this.WaveLink.setInputConfig(
                `${input.identifier}_${extension}_volume_change`,
                kPropertyVolume,
                false,
                input.identifier,
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

        this.mixers.set(`${input.identifier}_${extension}`, mixerAssignment);
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
        let identifierLocal = `${identifier}_monitor`;
        let identifierStream = `${identifier}_stream`;
        
        // Find the mixer for monitor
        if (this.mixers.has(identifierLocal))
        {
            console.log('Deleting mixer', identifierLocal);
            // Delete from MIDI Mixer
            this.mixers.get(identifierLocal).remove();
            // Delete from mixers
            this.mixers.delete(identifierLocal);
        }

        // Find the mixer for stream
        if (this.mixers.has(identifierStream))
        {
            console.log('Deleting mixer', identifierStream);
            // Delete from MIDI Mixer
            this.mixers.get(identifierStream).remove();
            // Delete from mixers
            this.mixers.delete(identifierStream);
        }

        if (this.soloButtons.has(identifier))
        {
            this.soloButtons.get(identifier).remove();
        }
    }
}