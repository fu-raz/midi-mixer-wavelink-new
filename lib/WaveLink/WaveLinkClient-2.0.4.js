const AppClient  = require('./AppClient');
const EventEmitter = require('events');

module.exports = class WaveLinkClient extends AppClient {

    static instance;

    constructor() {
        super(1824);

        if (WaveLinkClient.instance)
            return WaveLinkClient.instance;

        WaveLinkClient.instance = this;
    }

    debug(str)
    {
        console.log(str);
    }

    init(system) {
        this.debug("Init WLC...");
  
        this.UP_MAC = system == 'mac' ? true : false; 
        this.UP_WINDOWS = system == 'windows' ? true : false;

		// this.sdDevices = sdDevices;

        this.isUpToDate = false;

        // this.awl = new AppWaveLink;

        this.event = new EventEmitter();
        this.onEvent = this.event.on;
        this.emitEvent = this.event.emit;

        this.apiVersion = 1;

        this.output = undefined;
        this.inputs = [];
        
        this.isMicrophoneConnected;
        this.microphones;
        this.localOutputs;
        this.streamOutputs
        this.selectedLocalOutput;
		this.selectedStreamOutput;
        this.switchState;

        this.foregroundAppName                 = '';
        this.foregroundAppGroupInputIdentifier = '';
        
        this.fadingDelay = 100;

        this.isKeyUpdated = new Map;

        this.suppressNotifications = {};
        this.suppressNotificationsTimer;

        this.localization;
        // this.loadLocalization();

        this.on(kJSONPropertyMicrophoneConfigChanged, [kJSONKeyIdentifier, kJSONKeyProperty, kJSONKeyValue], (identifier, property, value) => {
            if (this.microphones?.length <= 0) {
                this.getMicrophoneConfig();
            } else if (this.propertyConverter(this.suppressNotifications.property) != property) {
                switch (property) {
                    case kPropertyMicrophoneGain:
                    case kPropertyMicrophoneOutputVolume:
                        value = this.getValueConverter(property).getIndexFromFirstValue(Math.round(value * 100) / 100);
                        break;
                    case kPropertyMicrophoneBalance:
                        value = value * 100;
                        break;
                    default:
                        break;
                }
 
                this.setMicrophone(identifier, property, value);
                this.throttleUpdate(property, kJSONPropertyMicrophoneConfigChanged, { property: property }, 250);
            }
        });

        this.on(kJSONPropertyOutputSwitched, [kJSONKeyValue], (value) => {
            this.switchState = value;
            this.emitEvent(kJSONPropertyOutputSwitched);
        });

		this.on(kJSONPropertySelectedOutputChanged, [kJSONKeyValue, kJSONKeyIdentifier, kJSONKeyMixerID], (value, identifier, mixerID) => {
			switch (mixerID) {
				case kPropertyMixerIDLocal:
					this.selectedLocalOutput = identifier;
					break;
				case kPropertyMixerIDStream:
					this.selectedStreamOutput = identifier;
					break;	
				default:
                    this.selectedLocalOutput = value;
					break;
			}

			this.emitEvent(kJSONPropertySelectedOutputChanged);
		});

        this.on(kJSONPropertyOutputsChanged, [], () => {
            this.getOutputs();
        });

        this.on(kJSONPropertyOutputMuteChanged, [kJSONKeyMixerID, kJSONKeyValue], (mixerID, value) => {
            if (mixerID == kPropertyMixerIDLocal) {
                this.output.local.isMuted = value;
            } else if (mixerID == kPropertyMixerIDStream) {
                this.output.stream.isMuted = value;
            }
            this.emitEvent(kJSONPropertyOutputMuteChanged, mixerID);
        });

        this.on(kJSONPropertyOutputVolumeChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            if (this.suppressNotifications.mixerID != mixerID || this.suppressNotifications.mixerID != kPropertyMixerIDAll) {
                const updateAll = { updateAll: true };
                if (mixerID == kPropertyMixerIDLocal) {
                    this.output.local.volume = value;
                    this.throttleUpdate(identifier + mixerID, kJSONPropertyOutputVolumeChanged, { mixerID, updateAll }, 250);
                } else if (mixerID == kPropertyMixerIDStream) {
                    this.output.stream.volume = value;
                    this.throttleUpdate(identifier + mixerID, kJSONPropertyOutputVolumeChanged, { mixerID, updateAll }, 250);
                }
            }
        });

        this.on(kJSONPropertyInputsChanged, [], () => {
            this.getInputConfigs();
            this.getMicrophoneConfig();
        });

        this.on(kJSONPropertyInputMuteChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            this.inputs.forEach(input => {
                if (input.identifier == identifier) {
                    if (mixerID == kPropertyMixerIDLocal) {
                        input.local.isMuted = value;
                    } else if (mixerID == kPropertyMixerIDStream) {
                        input.stream.isMuted = value;
                    }
                    this.emitEvent(kJSONPropertyInputMuteChanged, { identifier, mixerID });
                }
            });
        });

        this.on(kJSONPropertyInputVolumeChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            if (this.suppressNotifications.identifier != identifier || (this.suppressNotifications.identifier == identifier && this.suppressNotifications.mixerID != kPropertyMixerIDAll)) {
                const updateAll = { updateAll: true };
                this.inputs.find(input => {
                    if (input.identifier == identifier) {
                        if (mixerID == kPropertyMixerIDLocal) {
                            input.local.volume = value;
                            this.throttleUpdate(identifier + mixerID, kJSONPropertyInputVolumeChanged, { identifier, mixerID, updateAll }, 250);
                        } else if (mixerID == kPropertyMixerIDStream) {
                            input.stream.volume = value;
                            this.throttleUpdate(identifier + mixerID, kJSONPropertyInputVolumeChanged, { identifier, mixerID, updateAll }, 250);
                        }
                    }
                });
            }
        });

		this.on(kJSONPropertyLevelmeterValuesChanged, [ 'MixerList' /*API 6*/, kJSONKeyMixerList, kJSONKeyIdentifier, kJSONKeyLocalMixer, kJSONKeyStreamMixer, kJSONKeyMicrophoneLevel], (inputOldList, inputList, outputIdentifier, outputLocal, outputStream, microphoneLevel) => {
            if (this.isAPIVersionOlderAs(7)) {
                inputList = inputOldList;
            }

            inputList.forEach(inputWL => {
                const input = this.getInput(inputWL.identifier);

                if (input) {
                    const hasInputLocalChanged = input.local?.levelLeft != parseInt(inputWL[kJSONKeyLocalMixer].levelLeft * 100) || input.local?.levelRight != parseInt(inputWL[kJSONKeyLocalMixer].levelRight * 100);
                    const hasInputStreamChanged = input.stream?.levelLeft != parseInt(inputWL[kJSONKeyStreamMixer].levelLeft * 100) || input.stream?.levelRight != parseInt(inputWL[kJSONKeyStreamMixer].levelRight * 100);

                    if (hasInputLocalChanged || hasInputStreamChanged) {
                        input.local.levelLeft = input.local.isMuted ? 0 : parseInt(inputWL[kJSONKeyLocalMixer].levelLeft * 100);
                        input.local.levelRight = input.local.isMuted ? 0 : parseInt(inputWL[kJSONKeyLocalMixer].levelRight * 100);
                        input.stream.levelLeft = input.stream.isMuted ? 0 : parseInt(inputWL[kJSONKeyStreamMixer].levelLeft * 100);
                        input.stream.levelRight = input.stream.isMuted ? 0 : parseInt(inputWL[kJSONKeyStreamMixer].levelRight * 100);

                        this.emitEvent(kJSONPropertyInputLevelChanged, { identifier: input.identifier });
                    }
                }
            });

			if (this.isAPIVersionOlderAs(7)) {
                const micConfig = this.getMicrophone();
                const micInput = inputList.find(inputWL => inputWL.identifier == micConfig.identifier);
                const hasMicrophoneChanged = micConfig?.levelLeft != parseInt(micInput[kJSONKeyLocalMixer].levelLeft * 100) || micConfig?.levelRight != parseInt(micInput[kJSONKeyLocalMixer].levelRight * 100);

                if (micInput && hasMicrophoneChanged) {
                    micConfig.levelLeft	= parseInt(micInput[kJSONKeyLocalMixer].levelLeft * 100);
                    micConfig.levelRight = parseInt(micInput[kJSONKeyLocalMixer].levelRight * 100);

                    this.emitEvent(kJSONPropertyMicrophoneLevelChanged);
                }
            } else {
                const micConfig = this.getMicrophone();
                const hasMicrophoneChanged = micConfig?.levelLeft != parseInt(microphoneLevel?.levelLeft * 100) || micConfig?.levelRight != parseInt(microphoneLevel?.levelRight * 100);

                if (micConfig && hasMicrophoneChanged, microphoneLevel?.levelLeft)
                {
                    micConfig.levelLeft	= parseInt(microphoneLevel?.levelLeft * 100);
                    micConfig.levelRight = parseInt(microphoneLevel?.levelRight * 100);

                    this.emitEvent(kJSONPropertyMicrophoneLevelChanged);
                }
            }

            const output = this.getOutput();

            if (output) {
                if (output.local?.levelLeft != parseInt(outputLocal.levelLeft * 100) || output.local?.levelRight != parseInt(outputLocal.levelRight * 100) ||
                    output.stream?.levelLeft != parseInt(outputStream.levelLeft * 100) || output.stream?.levelRight != parseInt(outputStream.levelRight * 100)) {
                    output.local.levelLeft = parseInt(outputLocal.levelLeft * 100);
                    output.local.levelRight = parseInt(outputLocal.levelRight * 100);
                    output.stream.levelLeft = parseInt(outputStream.levelLeft * 100);
                    output.stream.levelRight = parseInt(outputStream.levelRight * 100);

                    this.emitEvent(kJSONPropertyOutputLevelChanged, { updateAll: true });
                }
            }
        });

        this.on(kJSONPropertyForegroundAppNameChanged, [kJSONKeyName], (name) => {
            if (this.foregroundAppName != name) {
                this.foregroundAppName = name;
                this.emitEvent(kJSONPropertyForegroundAppNameChanged);
            }
        });

        this.on(kJSONPropertyForegroundAppIdentifierChanged, [kJSONKeyIdentifier], (identifier) => {
            if (this.foregroundAppGroupInputIdentifier != identifier) {
                this.foregroundAppGroupInputIdentifier = identifier;
                this.emitEvent(kJSONPropertyForegroundAppIdentifierChanged);
            }
        });

        this.on(kJSONPropertyInputNameChanged, [kJSONKeyIdentifier, kJSONKeyValue], (identifier, value) => {
            this.inputs.forEach(input => {
                if (input.identifier == identifier) {
                    input.name = value;
                    this.emitEvent(kJSONPropertyInputNameChanged, { identifier });
                    this.emitEvent(kPropertyUpdatePI);
                }
            });
        });

        this.on(kJSONPropertyInputEnabled, [kJSONKeyIdentifier], (identifier) => {
            this.getInputConfigs();
            this.getMicrophoneConfig();
        });

        this.on(kJSONPropertyInputDisabled, [kJSONKeyIdentifier], (identifier) => {
            this.getInputConfigs();
            this.getMicrophoneConfig();
        });

		this.on(kJSONPropertyProfileChanged, [], () => {
			this.getApplicationInfo();
		});

        this.on(kJSONPropertyFilterBypassStateChanged, [kJSONKeyIdentifier, kJSONKeyMixerID, kJSONKeyValue], (identifier, mixerID, value) => {
            const input = this.getInput(identifier);
            if (mixerID == kPropertyMixerIDLocal) {
                input.local.filterBypass = value;
            } else if (mixerID == kPropertyMixerIDStream) {
                input.stream.filterBypass = value;
            }
            this.emitEvent(kJSONPropertyFilterBypassStateChanged, { identifier, mixerID });
        });

        this.on(kJSONPropertyFilterAdded,
            [kJSONKeyIdentifier, kJSONKeyFilterID, kJSONKeyFilterName, kJSONKeyFilterActive, kJSONKeyFilterPluginID, kJSONKeyFilterpluginFilePath],
            (identifier, filterID, name, isActive, pluginID, pluginFilePath) => {
                const input = this.getInput(identifier);

                if (!input.filters) {
                    input.filters = [];
                }

                input.filters.push({ 
                    [kJSONKeyFilterID]: filterID,
                    [kJSONKeyFilterName]: name,
                    [kJSONKeyFilterActive]: isActive,
                    [kJSONKeyFilterPluginID]: pluginID
                });
                this.emitEvent(kPropertyUpdatePI);
            }
        );

        this.on(kJSONPropertyFilterChanged, [kJSONKeyIdentifier, kJSONKeyFilterID, kJSONKeyValue], (identifier, filterID, value) => {
            const input = this.getInput(identifier);

            const filter = input.filters.find(filter => filter.filterID == filterID);
            filter.isActive = value;
            this.emitEvent(kJSONPropertyFilterChanged, { identifier, filterID });
        });

        this.on(kJSONPropertyFilterRemoved, [kJSONKeyIdentifier, kJSONKeyFilterID], (identifier, filterID) => {
            const input = this.getInput(identifier);
            input.filters = input.filters.filter(filter => filter.filterID != filterID);
            this.emitEvent(kPropertyUpdatePI);
        });


        this.onConnection(() => {
            this.getApplicationInfo();
        });

        this.onDisconnection(() => {
            this.isUpToDate = false;

            this.emitEvent(kPropertyUpdatePI);
            this.emitEvent(kPropertyOutputChanged);
            this.emitEvent(kJSONPropertyInputsChanged);
        });
    }

    async loadLocalization() {
        await $SD.loadLocalization('');
        
        this.localization = $SD.localization;
    }

    async getApplicationInfo() {
        this.call(kJSONPropertyGetApplicationInfo).then((result) => {
            if (result || result == undefined) {
                this.apiVersion = result[kJSONKeyInterfaceRevision];

                if (result[kJSONKeyInterfaceRevision] >= kJSONPropertyMinimumSupportedAPIVersion) {
                    this.isUpToDate = true;
                    this.debug(`Supported api version for ${kJSONPropertyAppName} found: ${this.apiVersion}`);
                    this.getMicrophoneConfig();
                    this.getSwitchState();
                    this.getOutputConfig();
                    this.getOutputs();
                    this.getInputConfigs();

                    // {
                    //     this.rpc.call('getForegroundAppGroupIdentifier').then((result) => {
                    //         if (result != null) {
                    //             this.foregroundAppName                 = result[kJSONKeyName];
                    //             this.foregroundAppGroupInputIdentifier = result[kJSONKeyIdentifier];

                    //             this.emitEvent(kJSONPropertyForegroundAppNameChanged);
                    //             this.emitEvent(kJSONPropertyForegroundAppIdentifierChanged);
                    //         }
                    //     });
                    // }

                    this.emitEvent(kPropertyUpdatePI);
                    this.emitEvent(kPropertyOutputChanged);
                } else {
                    this.isUpToDate = false;
                    if (result[kJSONKeyInterfaceRevision] > kJSONPropertyMaximumSupportedAPIVersion)
                        this.debug(`Wrong api version for ${kJSONPropertyAppName} found: Current ${this.apiVersion}, Maximum: ${kJSONPropertyMaximumSupportedAPIVersion}`);
                    else 
                        this.debug(`Wrong api version for ${kJSONPropertyAppName} found: Current ${this.apiVersion}, Minimum: ${kJSONPropertyMinimumSupportedAPIVersion}`);
                    this.emitEvent(kPropertyUpdatePI);
                    this.emitEvent(kPropertyOutputChanged);
                    this.emitEvent(kJSONPropertyInputsChanged);
                }
            }
        });
    }

    getMicrophoneConfig() {
        this.rpc.call(kJSONPropertyGetMicrophoneConfig).then((result) => {
            if (result != null) {
                this.microphones = result;

                this.gainConverter = undefined;
                this.outputVolumeConverter = undefined;

                this.microphones.forEach(microphone => {
                    microphone.gainIndex = new LookupTableConverter(microphone.gainLookup).getIndexFromFirstValue(microphone.gain);
                    microphone.outputVolumeIndex = new LookupTableConverter(microphone.outputVolumeLookup).getIndexFromFirstValue(microphone.outputVolume);
                    microphone.balanceIndex = microphone.balance * 100;
                });

                this.emitEvent(kJSONPropertyGetMicrophoneConfig);
            }
        });
    }

    setMicrophoneConfig(context, property, value = 0) {
        this.checkAppState();

        if (this.microphones?.length < 1)
            throw `No device available`

        const microphone = this.getMicrophone();

        var isBoolValue = false;

        if (microphone) {
            switch (property) {
                case kPropertyMicrophoneLowCut:
                case kPropertyMicrophoneClipGuard:
                case kPropertyMicrophoneMute:
                    isBoolValue = true;
                    break;
                default:
                    break;
            }

            const valueKey = isBoolValue ? kJSONKeyBoolValue : kJSONKeyValue;

            this.setMicrophone(microphone.identifier, property, value);

            switch (property) {
                case kJSONPropertyGain:
                    value = new LookupTableConverter(microphone.gainLookup).getFirstValueFromIndex(microphone.gainIndex);
                    break;
                case kJSONPropertyOutputVolume:
                    value = new LookupTableConverter(microphone.outputVolumeLookup).getFirstValueFromIndex(microphone.outputVolumeIndex);
                    break;
                default:
                    break;
            }

            this.suppressNotifications.property = property;

            if (this.suppressNotificationsTimer) {
                clearTimeout(this.suppressNotificationsTimer);
            }
            this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.property = ''; }, 250);
            this.throttleUpdate(context, kJSONPropertyMicrophoneConfigChanged, { property: this.propertyConverter(property), context: context }, 200);

            this.rpc.call(kJSONPropertySetMicrophoneConfig, {
                [kJSONKeyIdentifier]: microphone.identifier,
                [kJSONKeyProperty]: property,
                [valueKey]: value
            });
        } 
    }

    getSwitchState() {
        this.rpc.call(kJSONPropertyGetSwitchState).then(
            (result) => {
                this.switchState = result[kJSONKeyValue];
                this.emitEvent(kJSONPropertyOutputSwitched);
            }
        );
    }

    changeSwitchState() {
        this.checkAppState();

        this.rpc.call(kJSONPropertySwitchOutput, {});
    };

	getOutputs() {
		this.rpc.call(kJSONPropertyGetOutputs).then(
			(result) => {
                this.localOutputs			= result[kJSONKeyOutputs][kJSONKeyLocalMixer];
                this.streamOutputs			= result[kJSONKeyOutputs][kJSONKeyStreamMixer];
                this.selectedLocalOutput	= result[kJSONKeySelectedOutput][kJSONKeyLocalMixer];
                this.selectedStreamOutput	= result[kJSONKeySelectedOutput][kJSONKeyStreamMixer];

				this.emitEvent(kPropertyUpdatePI);
				this.emitEvent(kJSONPropertySelectedOutputChanged);
			}
		);
	}

	setSelectedOutput(identifier, mixerID) {
		this.checkAppState();
		
        const outputs = mixerID == kPropertyMixerIDLocal ? this.localOutputs : this.streamOutputs;
		const output = outputs.find(output => output.identifier == identifier);
        if (output != undefined) {
            let name;

            if (output.identifier == 'PCM_IN_01_V_00_SD2') {
                name = this.localization['PI']['outputSelection']['streamOut'];
            } else {
                name = output.name;
            }

            this.rpc.call(kJSONPropertySetSelectedOutput, {
                [kJSONKeyName]: name,
                [kJSONKeyMixerID]: mixerID,
                [kJSONKeyIdentifier]: identifier
            });
        }
	}

    getOutputConfig() {
        this.rpc.call(kJSONPropertyGetOutputConfig).then(
            (result) => {
                this.output = {
                    local: {
                        isMuted: result[kJSONKeyLocalMixer][0],
                        volume: result[kJSONKeyLocalMixer][1],
						levelLeft: 0,
						levelRight: 0
                    },
                    stream: {
                        isMuted: result[kJSONKeyStreamMixer][0],
                        volume: result[kJSONKeyStreamMixer][1],
						levelLeft: 0,
						levelRight: 0
                    },
                    [kJSONKeyBgColor]: '#1E183C',
                    isNotBlockedLocal: true,
                    isNotBlockedStream: true
                }
                this.emitEvent(kPropertyOutputChanged);
                this.emitEvent(kPropertyUpdatePI);
            }
        );
    }
 
    setOutputConfig(context, property, isAdjustVolume, mixerID, value, fadingTime) {
        this.checkAppState();

        const output = this.getOutput();
        const updateAll = { updateAll: true }
        const forceLink = mixerID == kPropertyMixerIDAll;

        if (output && fadingTime) {
            const isAlreadyFading = mixerID == kPropertyMixerIDLocal ? !output.isNotBlockedLocal : !output.isNotBlockedStream;

            if (isAlreadyFading) {
                return;
            }

            var timeLeft = fadingTime;
            var newValue = 0;

            const intervalTimer = setInterval(() => {
                if (timeLeft > 0) {
                    const currentValue = mixerID == kPropertyMixerIDLocal ? output.local.volume : output.stream.volume;
                    const volumeSteps = (value - currentValue) / (timeLeft / this.fadingDelay);

                    newValue = currentValue +  Math.round(volumeSteps, 2);
                    mixerID == kPropertyMixerIDLocal ? output.isNotBlockedLocal = false : output.isNotBlockedStream = false;

                    timeLeft -= this.fadingDelay;

                    mixerID == kPropertyMixerIDLocal ? output.local.volume = newValue : output.stream.volume = newValue;
                } else {
                    mixerID == kPropertyMixerIDLocal ? output.isNotBlockedLocal = true : output.isNotBlockedStream = true;
                    clearInterval(intervalTimer);
                }

                this.suppressNotifications.mixerID = mixerID;

                if (this.suppressNotificationsTimer) {
                    clearTimeout(this.suppressNotificationsTimer);
                }
                this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.mixerID = ''; }, 250);
                this.throttleUpdate(context, kJSONPropertyOutputVolumeChanged, { context, mixerID, updateAll }, 100);
    
                this.rpc.call(kJSONPropertySetOutputConfig, {
                    [kJSONKeyProperty]: property,
                    [kJSONKeyMixerID]: mixerID,
                    [kJSONKeyValue]: newValue,
                    [kJSONKeyForceLink]: forceLink
                });

            }, this.fadingDelay)
        } else {
            var newValue = 0;
            var newMixerID = mixerID == kPropertyMixerIDAll && property != kPropertyOutputMute ? kPropertyMixerIDStream : mixerID;

            if (isAdjustVolume) {
                if (mixerID == kPropertyMixerIDLocal || forceLink)
                    newValue = output.local.volume  = output.local.volume + value < 0 ? 0 : output.local.volume + value > 100 ? 100 : output.local.volume + value;

                if (mixerID == kPropertyMixerIDStream || forceLink)
                    newValue = output.stream.volume = output.stream.volume + value < 0 ? 0 : output.stream.volume + value > 100 ? 100 : output.stream.volume + value;
            } else {
                newValue = value;
            }

            this.suppressNotifications.mixerID = newMixerID;

            if (this.suppressNotificationsTimer) {
                clearTimeout(this.suppressNotificationsTimer);
            }
            this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.mixerID = ''; }, 250);
            this.throttleUpdate(context, kJSONPropertyOutputVolumeChanged, { context, mixerID, updateAll }, 100);

            this.rpc.call(kJSONPropertySetOutputConfig, {
                [kJSONKeyProperty]: property,
                [kJSONKeyMixerID]: newMixerID,
                [kJSONKeyValue]: newValue,
                [kJSONKeyForceLink]: forceLink
            });
        }
    }

    getInputConfigs() {
        this.rpc.call(kJSONPropertyGetInputConfigs).then((result) => {
            this.inputs = [];
            result.forEach(async input => {
                this.inputs.push({
                    [kJSONKeyIdentifier]:     input[kJSONKeyIdentifier],
                    [kJSONKeyInputs]:         input[kJSONKeyInputs],
                    [kJSONKeyIsWaveMicInput]: input[kJSONKeyIsWaveMicInput],
                    [kJSONKeyName]:           input[kJSONKeyName],
                    [kJSONKeyInputType]:      input[kJSONKeyInputType],
                    [kJSONKeyIsAvailable]:    input[kJSONKeyIsAvailable],
                    [kJSONKeyBgColor]:        input[kJSONKeyBgColor],
                    [kJSONKeyIconData]:       input[kJSONKeyIconData],
                    [kJSONKeyFilters]:        input[kJSONKeyFilters], 

                    local: {
                        isMuted: input[kJSONKeyLocalMixer][0],
                        volume: input[kJSONKeyLocalMixer][1],
                        filterBypass: input[kJSONKeyLocalMixer][2],
                        levelLeft: 0,
                        levelRight: 0
                    },
                    stream: {
                        isMuted: input[kJSONKeyStreamMixer][0],
                        volume: input[kJSONKeyStreamMixer][1],
                        filterBypass: input[kJSONKeyStreamMixer][2],
                        levelLeft: 0,
                        levelRight: 0
                    },

                    isNotBlockedLocal:  true,
                    isNotBlockedStream: true
                });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                if (input.iconData) {
                    const macIcon = '<image id="appIcon" width="144" height="144" x="0" y="0" xlink:href="data:image/png;base64,' + input.iconData + '"/>';
                }
            });
            this.emitEvent(kJSONPropertyInputsChanged);
            this.emitEvent(kPropertyUpdatePI);

        });
    }

    setInputConfig(context, property, isAdjustVolume, identifier, mixerID, value, fadingTime) {
        this.checkAppState();

        const input     = this.getInput(identifier);
        const updateAll = { updateAll: true };
        const forceLink = mixerID == kPropertyMixerIDAll;

        let newMixerID  = mixerID;
        var newValue    = 0;

        if (forceLink) {
            if (isAdjustVolume) {
                if (value < 0) {
                    newMixerID = input.local.volume > input.stream.volume ? kPropertyMixerIDLocal : kPropertyMixerIDStream;
                } else {
                    newMixerID = input.local.volume < input.stream.volume ? kPropertyMixerIDLocal : kPropertyMixerIDStream;
                }
            } else if (property == kPropertyVolume) {
                newMixerID = kPropertyMixerIDStream;
            }
        }

        if (input && fadingTime) {
            const isAlreadyFading = newMixerID == kPropertyMixerIDLocal ? !input.isNotBlockedLocal : !input.isNotBlockedStream;

            if (isAlreadyFading) {
                return;
            }

            let timeLeft = fadingTime;

            const intervalTimer = setInterval(() => {
                if (timeLeft > 0) {
                    const currentValue = newMixerID == kPropertyMixerIDLocal ? input.local.volume : input.stream.volume;
                    const volumeSteps = (value - currentValue) / (timeLeft / this.fadingDelay);

                    newValue = currentValue + Math.round(volumeSteps, 2);
                    console.log("Current Value", currentValue, "New Value", newValue)
                    newMixerID == kPropertyMixerIDLocal ? input.isNotBlockedLocal = false : input.isNotBlockedStream = false;

                    timeLeft -= this.fadingDelay;

                    newMixerID == kPropertyMixerIDLocal ? input.local.volume = newValue : input.stream.volume = newValue;
                } else {
                    newMixerID == kPropertyMixerIDLocal ? input.isNotBlockedLocal = true : input.isNotBlockedStream = true;
                    clearInterval(intervalTimer);
                }

                this.suppressNotifications.identifier = identifier;
                this.suppressNotifications.mixerID    = newMixerID;

                if (this.suppressNotificationsTimer) {
                    clearTimeout(this.suppressNotificationsTimer);
                }

                this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.identifier = ''; this.suppressNotifications.mixerID = ''; }, 250);
                this.throttleUpdate(context, kJSONPropertyInputVolumeChanged, { context, identifier, newMixerID, updateAll }, 100);

                this.rpc.call(kJSONPropertySetInputConfig, {
                    [kJSONKeyProperty]: property,
                    [kJSONKeyIdentifier]: identifier,
                    [kJSONKeyMixerID]: newMixerID,
                    [kJSONKeyValue]: newValue,
                    [kJSONKeyForceLink]: forceLink
                });

            }, this.fadingDelay)
        } else {
            if (isAdjustVolume) {
                if (newMixerID == kPropertyMixerIDLocal) {
                    newValue = input.local.volume  = input.local.volume + value < 0 ? 0 : input.local.volume + value > 100 ? 100 : input.local.volume + value;

                    if (forceLink) {
                        input.stream.volume = input.stream.volume + value < 0 ? 0 : input.stream.volume + value > 100 ? 100 : input.stream.volume + value;
                    }
                }

                if (newMixerID == kPropertyMixerIDStream) {
                    newValue = input.stream.volume = input.stream.volume + value < 0 ? 0 : input.stream.volume + value > 100 ? 100 : input.stream.volume + value;

                    if (forceLink) {
                        input.local.volume  = input.local.volume + value < 0 ? 0 : input.local.volume + value > 100 ? 100 : input.local.volume + value;
                    }
                }

                this.suppressNotifications.identifier = identifier;
                this.suppressNotifications.mixerID    = mixerID;
            } else {
                newValue = value;
            }

            if (this.suppressNotificationsTimer) {
                clearTimeout(this.suppressNotificationsTimer);
            }
            
            this.suppressNotificationsTimer = setTimeout( () => { this.suppressNotifications.identifier = ''; this.suppressNotifications.mixerID = ''; }, 250);
            this.throttleUpdate(context, kJSONPropertyInputVolumeChanged, { context, identifier, mixerID, updateAll }, 100);

            this.rpc.call(kJSONPropertySetInputConfig, {
                [kJSONKeyProperty]: property,
                [kJSONKeyIdentifier]: identifier,
                [kJSONKeyMixerID]: newMixerID,
                [kJSONKeyValue]: newValue,
                [kJSONKeyForceLink]: forceLink
            });
        }
    }

    setFilterBypass(identifier, mixerID, value) {
        this.checkAppState();

        this.rpc.call(kJSONPropertySetFilterBypass, {
            [kJSONKeyIdentifier]: identifier,
            [kJSONKeyMixerID]: mixerID,
            [kJSONKeyValue]: value
        });
    }

    setFilterConfig(identifier, filterID, value) {
        this.checkAppState();

        this.rpc.call(kJSONPropertySetFilter, {
            [kJSONKeyIdentifier]: identifier,
            [kJSONKeyFilterID]: filterID,
            [kJSONKeyValue]: value
        });
    }

	async addInput(identifier) {
		const result = await this.rpc.call(kJSONPropertyAddInput, {
			[kJSONKeyIdentifier]: identifier
		}).then((result) => {
			return result[kJSONKeyValue];
		});

        if (result)
            return result;
        else
            throw 'Add input failed.';
    };

    getMicrophone(identifier) {
        let microphoneConfig = undefined;

        if (this.isAPIVersionOlderAs(7)) {
            this.microphones?.forEach(micConfig => {
                if (this.inputs.find(input => input.identifier == micConfig.identifier)?.isAvailable)
                    microphoneConfig = micConfig;
            });
        } else {
            const groupInput = this.inputs.find(groupInput => groupInput.isWaveMicInput && groupInput.isAvailable);

            this.microphones?.forEach(micConfig => {
                if (groupInput?.inputs?.find(input => input.identifier == micConfig.identifier) != undefined) {
                    microphoneConfig = micConfig;
                }
            });
        }

        return microphoneConfig;
    }

    setMicrophone(identifier, property, value) {
        const microphone = this.getMicrophone(identifier);

        if (microphone != undefined) {
            switch (this.propertyConverter(property)) {
                case kPropertyMicrophoneGain:
                    const gainConverter = new LookupTableConverter(microphone.gainLookup);
                    microphone.gainIndex = this.checkValueIsInRange(value, 0, gainConverter?.length - 1);
                    microphone.gain = gainConverter.getFirstValueFromIndex(microphone.gainIndex);
                    break;
                case kPropertyMicrophoneOutputVolume:
                    const outputVolumenConverter = new LookupTableConverter(microphone.outputVolumeLookup);
                    microphone.outputVolumeIndex = this.checkValueIsInRange(value, 0, outputVolumenConverter?.length - 1);
                    microphone.outputVolume = outputVolumenConverter.getFirstValueFromIndex(microphone.outputVolumeIndex);
                    break;
                case kPropertyMicrophoneBalance:
                    microphone.balanceIndex = this.checkValueIsInRange(value, 0, 100);
                    microphone.balance = this.checkValueIsInRange(microphone.balanceIndex / 100, 0, 1);
                    break;
                case kPropertyMicrophoneLowCut:
                    microphone.isLowCutOn = value;
                    break;
                case kPropertyMicrophoneClipGuard:
                    microphone.isClipGuardOn = value;
                    break;
                case kPropertyMicrophoneLowCutType:
                    microphone.lowCutType = value;
                    break;
                case kPropertyMicrophoneGainLock:
                    microphone.isGainLocked = value;
                    break;
                case kPropertyMicrophoneMute:
                    microphone.isMicMuted = value;
                    break;
                default:
                    break;
            }
        }
    }

    // TODO: Change WebSocketInterface
    propertyConverter(property) {
        var waveLinkProperty = property;
        switch (property) {
            case kJSONPropertyGain:
                waveLinkProperty = kPropertyMicrophoneGain
                break;
            case kJSONPropertyOutputVolume:
                waveLinkProperty = kPropertyMicrophoneOutputVolume;
                break;
            case kJSONPropertyBalance:
                waveLinkProperty = kPropertyMicrophoneBalance;
                break;
            case kJSONKeyClipGuard:
                waveLinkProperty = kPropertyMicrophoneClipGuard;
                break;
            case kJSONKeyLowCut:
                waveLinkProperty = kPropertyMicrophoneLowCut;
                break;
            case kJSONKeyLowCutType:
                waveLinkProperty = kPropertyMicrophoneLowCutType;
                break;
            default:
                break;
        }
        return waveLinkProperty;
    }

    getValueConverter(property) {
        switch (property) {
            case kPropertySetGain:
            case kPropertyAdjustGain:
            case kPropertyMicrophoneGain:
                if (this.gainConverter == undefined)
                    this.gainConverter = new LookupTableConverter(this.getMicrophone()?.gainLookup)

                return this.gainConverter;
            case kPropertySetOutput:
            case kPropertyAdjustOutput:
            case kPropertyMicrophoneOutputVolume:
                if (this.outputVolumeConverter == undefined)
                    this.outputVolumeConverter = new LookupTableConverter(this.getMicrophone()?.outputVolumeLookup)

                return this.outputVolumeConverter;
            default:
                return;
        }
    }

	getOutput() {
		return this.output;
	}

    getInput(identifier) {
        if (this.isAPIVersionOlderAs(7)) {
            return this.inputs.find(input => input.identifier.includes(identifier));
        } else {
            if (identifier == 'Foreground App') {
                identifier = this.foregroundAppGroupInputIdentifier;

                if (this.foregroundAppGroupInputIdentifier == '')
                    return undefined;
            }

            let input = this.inputs.find(groupInput => groupInput.identifier.includes(identifier));

            if (input == undefined) {
                const mapping = new Map([
                    ['PCM_IN_01_C_00_SD1' , 'Wave Link Mic In 1'],
                    ['PCM_OUT_01_V_00_SD2', 'Wave Link Systems'],
                    ['PCM_OUT_01_V_02_SD3', 'Wave Link Music'],
                    ['PCM_OUT_01_V_04_SD4', 'Wave Link Browser'],
                    ['PCM_OUT_01_V_06_SD5', 'Wave Link Voice Chat'],
                    ['PCM_OUT_01_V_08_SD6', 'Wave Link SFX'],
                    ['PCM_OUT_01_V_10_SD7', 'Wave Link Game'],
                    ['PCM_OUT_01_V_12_SD8', 'Wave Link Aux 1'],
                    ['PCM_OUT_01_V_14_SD9', 'Wave Link Aux 2']
                ]);

                const newIdentifier = mapping.get(identifier);

                if (newIdentifier == undefined) {
                    this.inputs.every(groupInput => {
                        if (groupInput.inputs?.find(input => input.identifier.includes(identifier)) != undefined) {
                            input = groupInput;
                        }

                        return input == undefined;
                    });
                } else {
                    input = this.inputs.find(groupInput => groupInput.identifier == newIdentifier);
                }
            }

            return input;
        }
    }

    // Helper methods
    isAPIVersionOlderAs(apiVersion) {
        return this.apiVersion < apiVersion;
    }

    throttleUpdate(context, event, payload, time) {
        if (!this.isKeyUpdated.get(context)) {
            this.isKeyUpdated.set(context, true);
            _setTimeoutESD(() => {
                this.emitEvent(event, payload);
                this.isKeyUpdated.delete(context);
            }, time);
        }  
    }

    fixNames = (name, maxlen = 27, suffix = ' &hellip;') => {
        return (name && name.length > maxlen ? name.slice(0, maxlen - 1) + suffix : name);
    };

    setConnectionState(state) {
        this.isConnected = state;
        this.emitEvent(kPropertyUpdatePI);
    }

    setAppIsRunning(state) {
        this.appIsRunning = state;
    }

    isAppStateOk() {
        return this.isConnected && this.isUpToDate;
    }

    checkAppState() {
        if (!this.isConnected || !this.isUpToDate) {
            throw `App not connected or update needed`
        }
    }

    checkValueIsInRange(value, minValue, maxValue) {
        return value = value < minValue ? minValue : value > maxValue ? maxValue : value;
    }
};