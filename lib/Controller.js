// Include plugin requirements
const { Assignment, ButtonType } = require("midi-mixer-plugin");
const WaveLinkClient = require("./WaveLink/WaveLinkClient");

module.exports = class Controller
{
    mixers = new Map();
    mixerLevels = new Map();
    mixerLevelsChanging = new Map();
    mixerLevelsChangingTimeouts = new Map();
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
    soloCurrentChannel = null;

    mixButtons = new Map();

    effectButtons = new Map();
    muteButtons = new Map();

    isConnected = false;
    reconnectionTimeout = 0;
    retryTimeout = 0;

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
        this.WaveLink.onEvent(kJSONPropertyOutputVolumeChanged, this.outputVolumeChanged.bind(this));

        console.log('Registering output mute change event', kJSONPropertyOutputMuteChanged);
        this.WaveLink.onEvent(kJSONPropertyOutputMuteChanged, this.outputMuteChanged.bind(this));

        console.log('Registering disconnect event');
        this.WaveLink.onEvent('webSocketIsDisconnected', this.disconnected.bind(this));

        console.log('Registering outputs changed event');
        this.WaveLink.onEvent(kJSONPropertySelectedOutputChanged, this.outputsChanged.bind(this));

        console.log('Registering microphone config event', kJSONPropertyGetMicrophoneConfig);
        this.WaveLink.onEvent(kJSONPropertyGetMicrophoneConfig, this.microphonesFetched.bind(this));

        console.log('Registering event on output switch (monitor/stream)', kJSONPropertyOutputSwitched);
        this.WaveLink.onEvent(kJSONPropertyOutputSwitched, this.outputMixChanged.bind(this));

        console.log('Registering Input level change event (for real time levels)', kJSONPropertyInputLevelChanged);
        this.WaveLink.onEvent(kJSONPropertyInputLevelChanged, this.inputLevelsChanged.bind(this));
        
        console.log('Registering Ouput level change event (for real time levels)', kJSONPropertyOutputLevelChanged);
        // this.WaveLink.onEvent(kJSONPropertyOutputLevelChanged, this.outputLevelsChanged.bind(this));

        console.log('Registering effect events');
        this.WaveLink.onEvent(kJSONPropertyFilterBypassStateChanged, this.effectBypassChanged.bind(this));
    }

    connected()
    {
        console.log('connected');
        this.isConnected = true;
        clearTimeout(this.reconnectionTimeout);
        $MM.setSettingsStatus('connectionStatus', 'Connected');

        // Create the mix buttons
        this.createMixSwitchButtons();
        this.WaveLink.getSwitchState();

        // Init level updates
        console.log('Starting level change interval');
        setInterval(this.changeLevels.bind(this), 100);
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
        // Try again after one minute
        this.reconnectionTimeout = setTimeout(this.tryConnect.bind(this), 60 * 1000);
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

    outputVolumeChanged(outputData)
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

    outputLevelsChanged(outputData)
    {
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
                    this.createEffectButton(input);
                    this.createMuteButton(input);
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

    restoreSoloSnapshot(oldInput)
    {
        // Reset 
        for (const [identifier, muted] of this.soloSnapshot)
        {
            if (oldInput === identifier || oldInput === undefined)
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
        }
    }

    createSoloSnapshot()
    {
        this.soloSnapshot = new Map();
        this.WaveLink.inputs.forEach((wavelinkInput) => {
            this.soloSnapshot.set(
                wavelinkInput.identifier,
                {
                    local: wavelinkInput.local.isMuted,
                    stream: wavelinkInput.stream.isMuted
                }
            );
        });
    }

    createMixSwitchButtons()
    {
        if (!this.mixButtons.has('mix_toggle_button'))
        {
            let mixToggleButton = new ButtonType('mix_toggle_button', {
                name: 'Toggle Monitor Mix <-> Stream Mix output',
                active: true
            });
    
            mixToggleButton.on('pressed', () => {
                this.WaveLink.changeSwitchState();
            });
            this.mixButtons.set('mix_toggle_button', mixToggleButton);
        }
        

        if (!this.mixButtons.has(kPropertyMixerIDLocal))
        {
            // Create button to switch to monitor mix
            let mixMonitorButton = new ButtonType('mix_monitor_button', {
                name: 'Listen to Monitor Mix',
                active: false
            });

            mixMonitorButton.on('pressed', () => {
                if (!mixMonitorButton.active)
                {
                    mixMonitorButton.active = true;
                    this.WaveLink.changeSwitchState();
                }
            });
            this.mixButtons.set(kPropertyMixerIDLocal, mixMonitorButton);
        }
        
        if (!this.mixButtons.has(kPropertyMixerIDStream))
        {
            // Create button to switch to stream mix
            let mixStreamButton = new ButtonType('mix_stream_button', {
                name: 'Listen to Stream Mix',
                active: false
            });

            mixStreamButton.on('pressed', () => {
                if (!mixStreamButton.active)
                {
                    mixStreamButton.active = true;
                    this.WaveLink.changeSwitchState();
                }
            });
            this.mixButtons.set(kPropertyMixerIDStream, mixStreamButton);
        }
    }

    outputMixChanged()
    {
        // Clear timeout if event happens before the time runs out
        if (this.retryTimeout) clearTimeout(this.retryTimeout);

        switch(this.WaveLink.switchState)
        {
            case kPropertyMixerIDStream:
                this.mixButtons.get(kPropertyMixerIDStream).active = true;
                this.mixButtons.get(kPropertyMixerIDLocal).active = false;
                break;
            case kPropertyMixerIDLocal:
                this.mixButtons.get(kPropertyMixerIDLocal).active = true;
                this.mixButtons.get(kPropertyMixerIDStream).active = false;
                break;
            default:
                // Let's try again in 30 seconds
                this.retryTimeout = setTimeout(this.WaveLink.getSwitchState, 30000);
                break;
        }
    }

    createEffectButton(input)
    {
        // Create effect bypass button for monitor
        let identifier = `${input.identifier}_effect_button`;

        let effectButtonMonitor = new ButtonType(`${identifier}_monitor`, {
            name: `Toggle Effect Bypass: ${input.name} Monitor`,
            active: !input.local.filterBypass
        });

        effectButtonMonitor.on('pressed', () => {
            this.WaveLink.setFilterBypass(input.identifier, kPropertyMixerIDLocal, effectButtonMonitor.active);
        });

        this.effectButtons.set(`${identifier}_monitor`, effectButtonMonitor);
        
        // Create effect bypass button for stream
        let effectButtonStream = new ButtonType(`${identifier}_stream`, {
            name: `Toggle Effect Bypass: ${input.name} Stream`,
            active: !input.stream.filterBypass
        });

        effectButtonStream.on('pressed', () => {
            this.WaveLink.setFilterBypass(input.identifier, kPropertyMixerIDStream, effectButtonStream.active);
        });
        this.effectButtons.set(`${identifier}_stream`, effectButtonStream);

        // Create effect bypass button for the whole channel
        let effectButtonAll = new ButtonType(`${identifier}_all`, {
            name: `Toggle Effect Bypass: ${input.name}`,
            active: !(input.stream.filterBypass && input.local.filterBypass)
        });

        effectButtonAll.on('pressed', () => {
            this.WaveLink.setFilterBypass(input.identifier, kPropertyMixerIDLocal, effectButtonAll.active);
            this.WaveLink.setFilterBypass(input.identifier, kPropertyMixerIDStream, effectButtonAll.active);
        });
        this.effectButtons.set(`${identifier}_all`, effectButtonAll);
    }

    createMuteButton(input)
    {
        // Create mute button for monitor
        let identifier = `${input.identifier}_mute_button`;

        let muteButtonMonitor = new ButtonType(`${identifier}_monitor`, {
            name: `Toggle Mute: ${input.name} Monitor`,
            active: input.local.isMuted
        });

        muteButtonMonitor.on('pressed', () => {
            this.WaveLink.setInputConfig(
                `${input.identifier}_mute_change`,
                kPropertyMute,
                false,
                input.identifier,
                kPropertyMixerIDLocal,
                !muteButtonMonitor.active
            );
        });

        this.muteButtons.set(`${identifier}_monitor`, muteButtonMonitor);
        
        // Create mute button for stream
        let muteButtonStream = new ButtonType(`${identifier}_stream`, {
            name: `Toggle Mute: ${input.name} Stream`,
            active: input.stream.isMuted
        });

        muteButtonStream.on('pressed', () => {
            this.WaveLink.setInputConfig(
                `${input.identifier}_mute_change`,
                kPropertyMute,
                false,
                input.identifier,
                kPropertyMixerIDStream,
                !muteButtonStream.active
            );
        });
        this.muteButtons.set(`${identifier}_stream`, muteButtonStream);
    }

    effectBypassChanged(inputData)
    {
        let identifier = `${inputData.identifier}_effect_button`;

        const effectButtonLocal = this.getButton(`${identifier}_monitor`);
        const effectButtonStream = this.getButton(`${identifier}_stream`);
        const effectButtonAll = this.getButton(`${identifier}_all`);

        if (inputData.mixerID == kPropertyMixerIDLocal)
        {
            effectButtonLocal.active = !effectButtonLocal.active;
        } else
        {
            effectButtonStream.active = !effectButtonStream.active;
        }

        if (effectButtonLocal.active && effectButtonStream.active)
        {
            effectButtonAll.active = true;
        } else if (!effectButtonLocal.active && !effectButtonStream.active)
        {
            effectButtonAll.active = false;
        }
    }

    createSoloButton(input)
    {
        let soloButton = new ButtonType(`${input.identifier}_solo_button`, {
            name: `Solo WaveLink input: ${input.name}`,
            active: false
        });

        soloButton.on('pressed', () => {
            if (this.soloCurrentChannel === null)
            {
                // There is no device in solo, so make this device the one
                this.createSoloSnapshot();
                
                // Enable flashing of button led
                this.soloInterval = setInterval(() => { soloButton.active = !soloButton.active; }, 500);

                // Set this channel to be the solo channel
                this.soloCurrentChannel = input.identifier;
            } else if (this.soloCurrentChannel == input.identifier)
            {
                // We are already in solo mode with this channel, so that must mean you want to disable it
                // Let's stop the led blinking
                clearInterval(this.soloInterval);
                soloButton.active = false;
                // Reset all mutes to the previous state
                this.restoreSoloSnapshot();
                // Set solo channel to null
                this.soloCurrentChannel = null;
            } else
            {
                // Let's stop the led blinking for the old led
                clearInterval(this.soloInterval);
                // Enable flashing of button led for this channel
                this.soloInterval = setInterval(() => { soloButton.active = !soloButton.active; }, 500);
                
                // There is another device currenly in solo. Revert that device to the old state
                this.restoreSoloSnapshot(this.soloCurrentChannel);

                // Set this channel to be the solo channel
                this.soloCurrentChannel = input.identifier;
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

                    if (this.muteButtons.has(`${inputData.identifier}_mute_button_monitor`))
                    {
                        this.muteButtons.get(`${inputData.identifier}_mute_button_monitor`).active = input.local.isMuted;
                    }
                }
            } else if (inputData.mixerID == kPropertyMixerIDStream)
            {
                let mixerAssignment = this.getMixerAssignment(`${inputData.identifier}_stream`);
                if (mixerAssignment)
                {
                    mixerAssignment.volume = input.stream.volume / 100;
                    mixerAssignment.muted = input.stream.isMuted;
                    mixerAssignment.name = `WaveLink: ${input.name} stream`;

                    if (this.muteButtons.has(`${inputData.identifier}_mute_button_stream`))
                    {
                        this.muteButtons.get(`${inputData.identifier}_mute_button_stream`).active = input.local.isMuted;
                    }
                }
            }
        }
    }

    changeMixerLevelTemp(mixerId, volume)
    {
        // Clear previous timeout
        clearTimeout( this.mixerLevelsChangingTimeouts.get(mixerId) );

        // Setting it to busy
        this.mixerLevelsChanging.set(mixerId, true);

        // Set Mixer meter level
        console.log('Setting mixerid', mixerId, 'to', volume);
        this.mixerLevels.set(mixerId, volume / 100);

        // Set timout 
        let timeoutInt = setTimeout( () => {
            this.mixerLevelsChanging.set(mixerId, false);
            this.mixerLevels.set(mixerId, 0);
        }, 2000);

        this.mixerLevelsChangingTimeouts.set(mixerId, timeoutInt);
    }

    inputLevelsChanged(inputData)
    {
        let input = this.WaveLink.getInput(inputData.identifier);

        let mixerAssignmentMonitor = this.getMixerAssignment(`${input.identifier}_monitor`);
        if (mixerAssignmentMonitor)
        {
            if (!this.mixerLevelsChanging.get(`${input.identifier}_monitor`))
            {
                this.mixerLevels.set(`${input.identifier}_monitor`, input.levelLeft / 100 * mixerAssignmentMonitor.volume);
            }
        }

        let mixerAssignmentStream = this.getMixerAssignment(`${input.identifier}_stream`);
        if (mixerAssignmentStream)
        {
            if (!this.mixerLevelsChanging.get(`${input.identifier}_stream`))
            {
                this.mixerLevels.set(`${input.identifier}_stream`, input.levelLeft / 100 * mixerAssignmentStream.volume);
            }
        }
    }

    changeLevels()
    {
        for (let [id, mixer] of this.mixers)
        {
            if (this.mixerLevels.has(id))
            {
                let lvl = this.mixerLevels.get(id);
                if (lvl > 0) mixer.meter = lvl;
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

    getButton(identifier)
    {
        if (this.effectButtons.has(identifier))
        {
            return this.effectButtons.get(identifier);
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

        let identifier = `${input.identifier}_${extension}`;

        mixerAssignment.on('volumeChanged', (level) => {
            // Unlike I previously thought, this is also needed here
            mixerAssignment.volume = level;

            // Change the WaveLink volume
            this.WaveLink.setInputConfig(
                `${identifier}_volume_change`,
                kPropertyVolume,
                false,
                input.identifier,
                mixerID,
                Math.round(level * 100)
            );

            this.changeMixerLevelTemp(identifier, input.local.volume);

            // Setting timeout to throttle output volume events
            clearTimeout(this.activeTimeout);
            this.activeTimeout = setTimeout(() => {
                this.activeTimeout = 0;
            }, 100);
        });

        mixerAssignment.on('mutePressed', () => {
            // Change the mute state in wavelink
            this.WaveLink.setInputConfig(
                `${identifier}_mute_change`,
                kPropertyMute,
                false,
                input.identifier,
                mixerID,
                !mixerAssignment.muted
            );
        });

        this.mixers.set(identifier, mixerAssignment);
        this.mixerLevels.set(identifier, 0);
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