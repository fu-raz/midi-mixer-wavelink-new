// Increase after interface has been changed
global.kJSONPropertyMinimumSupportedAPIVersion = '6';
global.kJSONPropertyMaximumSupportedAPIVersion = '7';

// Request
// Common
global.kJSONPropertyGetApplicationInfo             = 'getApplicationInfo';

// Microphone
global.kJSONPropertyGetMicrophoneConfig            = 'getMicrophoneConfig';
global.kJSONPropertySetMicrophoneConfig            = 'setMicrophoneConfig';

// Output
global.kJSONPropertyGetSwitchState                 = 'getSwitchState';
global.kJSONPropertySwitchOutput                   = "switchOutput";
global.kJSONPropertyGetOutputConfig                = 'getOutputConfig';
global.kJSONPropertySetOutputConfig                = 'setOutputConfig';
global.kJSONPropertyGetOutputs                     = 'getOutputs';
global.kJSONPropertySetSelectedOutput              = 'setSelectedOutput';

// Input
global.kJSONPropertyAddInput                       = 'addInput';
global.kJSONPropertyGetInputConfigs                = 'getInputConfigs';
global.kJSONPropertySetInputConfig                 = 'setInputConfig';
global.kJSONPropertySetFilterBypass                = 'setFilterBypass';
global.kJSONPropertySetFilter                      = 'setFilter';

// Notifications
global.kPropertyUpdatePI                           = 'updatePI';
global.kPropertyOutputChanged                      = 'outputChanged';

// Microphone
global.kJSONPropertyMicrophoneConfigChanged        = "microphoneConfigChanged";
global.kJSONPropertyMicrophoneLevelChanged         = "microphoneLevelChanged";

global.kJSONKeyDeviceType                          = "deviceType";
global.kJSONPropertyGain                           = "gain";
global.kJSONKeyIsGainLocked                        = "isGainLocked"
global.kJSONPropertyOutputVolume                   = "outputVolume";
global.kJSONPropertyBalance                        = "balance";
global.kJSONKeyLowCut                              = "isLowCutOn";
global.kJSONKeyClipGuard                           = "isClipGuardOn";
global.kJSONKeyLowCutType                          = "lowCutType";
global.kJSONKeyIsMicrophoneMuted                   = "isMicMuted";

// Output
global.kJSONPropertyOutputSwitched                 = "outputSwitched";
global.kJSONPropertySelectedOutputChanged          = "selectedOutputChanged";
global.kJSONPropertyOutputMuteChanged              = "outputMuteChanged";
global.kJSONPropertyOutputVolumeChanged            = "outputVolumeChanged";
global.kJSONPropertyOutputLevelChanged             = "outputLevelChanged";
global.kJSONPropertyOutputsChanged                 = "outputsChanged";

// Input
global.kJSONPropertyInputNameChanged               = "inputNameChanged";
global.kJSONPropertyInputMuteChanged               = "inputMuteChanged";
global.kJSONPropertyInputVolumeChanged             = "inputVolumeChanged";
global.kJSONPropertyInputLevelChanged              = "inputLevelChanged";
global.kJSONPropertyInputEnabled                   = "inputEnabled";
global.kJSONPropertyInputDisabled                  = "inputDisabled";
global.kJSONPropertyFilterBypassStateChanged       = "filterBypassStateChanged";
global.kJSONPropertyFilterChanged                  = 'filterChanged';
global.kJSONPropertyFilterAdded                    = 'filterAdded';
global.kJSONPropertyFilterRemoved                  = 'filterRemoved';
global.kJSONPropertyInputsChanged                  = 'inputsChanged';
global.kJSONPropertyProfileChanged                 = "profileChanged";
global.kJSONPropertyLevelmeterValuesChanged        = "realTimeChanges";
global.kJSONPropertyForegroundAppNameChanged       = "foregroundAppNameChanged";
global.kJSONPropertyForegroundAppIdentifierChanged = "foregroundAppIdentifierChanged";

// Keys / Properties
// Common
global.kJSONKeyInputs                              = 'inputs';
global.kJSONKeyIdentifier                          = 'identifier';
global.kJSONKeyName                                = 'name';
global.kJSONKeyProperty                            = 'property';
global.kJSONKeyValue                               = 'value';
global.kJSONKeyLevelLeft                           = 'levelLeft';
global.kJSONKeyLevelRight                          = 'levelRight';
global.kJSONKeyBoolValue                           = 'boolValue';
global.kJSONKeyIsAdjustVolume                      = 'isAdjustVolume';
global.kJSONKeyMixerID                             = 'mixerID';
global.kJSONKeyLocalMixer                          = "localMixer";
global.kJSONKeyStreamMixer                         = "streamMixer";
global.kJSONKeyMixerList                           = "mixerList";
global.kJSONKeyMicrophoneLevel                     = "microphoneLevel";

global.kPropertySuffixPlus                         = 'Plus';
global.kPropertySuffixMinus                        = 'Minus';
global.kPropertySuffixOn                           = 'On';
global.kPropertySuffixOff                          = 'Off';
global.kPropertySuffixMuted                        = 'Muted';

// Wave Link / Plugin
global.kPropertyVolume                             = "Volume";
global.kPropertyMute                               = "Mute";

global.kPropertyOutputLevel                        = "Output Level";
global.kPropertyOutputMute                         = "Output Mute";

global.kPropertyMixerIDLocal                       = "com.elgato.mix.local";
global.kPropertyMixerIDStream                      = "com.elgato.mix.stream";
global.kPropertyMixerIDAll                         = "com.elgato.mix.all";

global.kJSONKeyForceLink                           = "forceLink";

// Application Info
global.kJSONKeyAppID                               = 'appID';
global.kJSONKeyAppName                             = 'appName';
global.kJSONKeyInterfaceRevision                   = 'interfaceRevision';

global.kJSONPropertyAppID                          = 'egwl';
global.kJSONPropertyAppName                        = 'Elgato Wave Link';

// Microphone
// Actions
global.kPropertySetGain                            = "setGain";
global.kPropertyAdjustGain                         = "adjustGain";
global.kPropertytoggleGainLock                     = "toggleGainLock";
global.kPropertySetOutput                          = "setOutput";
global.kPropertyAdjustOutput                       = "adjustOutput"
global.kPropertySetMicPcBalance                    = "setMic/PcBalance";
global.kPropertyAdjustMicPcBalance                 = "adjustMic/PcBalance";
global.kPropertyToggleLowcut                       = "setLowcut";
global.kPropertyToggleClipguard                    = "setClipguard";
global.kPropertyToggleHardwareMute                 = "toggleHardwareMute";

// WL Types
global.kPropertyMicrophoneLowCut                   = "Microphone LowCut";
global.kPropertyMicrophoneClipGuard                = "Microphone ClipGuard";
global.kPropertyMicrophoneLowCutType               = "XLR Low Cut Type";
global.kPropertyMicrophoneGainLock                 = "Microphone GainLock";
global.kPropertyMicrophoneMute                     = "Microphone Mute";
global.kPropertyMicrophoneGain                     = "Microphone Gain";
global.kPropertyMicrophoneOutputVolume             = "Microphone Output Volume";
global.kPropertyMicrophoneBalance                  = "Microphone DirectMonitor Volume";

// Output
global.kJSONKeySelectedOutput                      = 'selectedOutput';
global.kJSONKeyOutputs                             = 'outputs';

// Input
global.kJSONKeyInputType                           = 'inputType';
global.kJSONKeyIsWaveMicInput                      = "isWaveMicInput";
global.kJSONKeyIconData                            = 'iconData';
global.kJSONKeyBgColor                             = 'bgColor';
global.kJSONKeyIsAvailable                         = 'isAvailable';
global.kJSONKeyFilters                             = 'filters';
global.kJSONKeyFilterID                            = 'filterID';
global.kJSONKeyFilterName                          = 'name';
global.kJSONKeyFilterActive                        = 'isActive';
global.kJSONKeyFilterPluginID                      = 'pluginID';
global.kJSONKeyFilterpluginFilePath                = 'pluginFilePath';

// Plugin
global.kPropertyDefault                            = 'default';
global.kPropertyWarning                            = 'warning';

global.ActionType = {
	Mute:				0,
	SetVolume:			1,
	AdjustVolume:		2,
	SetEffect:			3,
	SetEffectChain:		4,
	SetDeviceSettings:	5,
	SetOutput:			6,
	ToggleOutput:		7,
	SwitchOutput:		8,
	AddInput:			9
}

global.DeviceType = {
	Invalid:	-1,
	Wave1:		0,
	Wave3:		1,
	WaveXLR:	2,
	WaveNeo:	3
}