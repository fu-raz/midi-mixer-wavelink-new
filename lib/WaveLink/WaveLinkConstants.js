// Request
// Common
global.kJSONPropertyGetApplicationInfo       = 'getApplicationInfo';

// Microphone
global.kJSONPropertyGetMicrophoneConfig      = 'getMicrophoneConfig';
global.kJSONPropertySetMicrophoneConfig      = 'setMicrophoneConfig';

// Output
global.kJSONPropertyGetSwitchState           = 'getSwitchState';
global.kJSONPropertySwitchOutput             = "switchOutput";
global.kJSONPropertyGetOutputConfig          = 'getOutputConfig';
global.kJSONPropertySetOutputConfig          = 'setOutputConfig';
global.kJSONPropertyGetOutputs               = 'getOutputs';
global.kJSONPropertySetSelectedOutput        = 'setSelectedOutput';

// Input
global.kJSONPropertyGetInputConfigs          = 'getInputConfigs';
global.kJSONPropertySetInputConfig           = 'setInputConfig';
global.kJSONPropertySetFilterBypass          = 'setFilterBypass';
global.kJSONPropertySetFilter                = 'setFilter';

// Notifications
global.kPropertyUpdatePI                     = 'updatePI';
global.kPropertyOutputChanged                = 'outputChanged';

// Microphone
global.kJSONPropertyMicrophoneConfigChanged  = "microphoneConfigChanged";

global.kJSONKeyIsWaveLink					           = "isWaveLink";
global.kJSONKeyIsWaveXLR					           = "isWaveXLR";
global.kJSONPropertyGain                     = "gain";
global.kJSONKeyIsGainLocked                  = "isGainLocked"
global.kJSONPropertyOutputVolume             = "outputVolume";
global.kJSONPropertyBalance                  = "balance";
global.kJSONKeyLowCut                        = "isLowCutOn";
global.kJSONKeyClipGuard                     = "isClipGuardOn";
global.kJSONKeyLowCutType                    = "lowCutType";
global.kJSONKeyIsMicrophoneMuted             = "isMicMuted";

// Output
global.kJSONPropertyOutputSwitched           = "outputSwitched";
global.kJSONPropertySelectedOutputChanged    = "selectedOutputChanged";
global.kJSONPropertyOutputMuteChanged        = "outputMuteChanged";
global.kJSONPropertyOutputVolumeChanged      = "outputVolumeChanged";
global.kJSONPropertyOutputLevelChanged       = "outputLevelChanged";

// Input
global.kJSONPropertyInputNameChanged         = "inputNameChanged";
global.kJSONPropertyInputMuteChanged         = "inputMuteChanged";
global.kJSONPropertyInputVolumeChanged       = "inputVolumeChanged";
global.kJSONPropertyInputLevelChanged        = "inputLevelChanged";
global.kJSONPropertyInputEnabled             = "inputEnabled";
global.kJSONPropertyInputDisabled            = "inputDisabled";
global.kJSONPropertyFilterBypassStateChanged = "filterBypassStateChanged";
global.kJSONPropertyFilterChanged            = 'filterChanged';
global.kJSONPropertyFilterAdded              = 'filterAdded';
global.kJSONPropertyFilterRemoved            = 'filterRemoved';
global.kJSONPropertyInputsChanged            = 'inputsChanged';

// Keys / Properties
// Common
global.kJSONKeyIdentifier                    = 'identifier';
global.kJSONKeyName                          = 'name';
global.kJSONKeyProperty                      = 'property';
global.kJSONKeyValue                         = 'value';
global.kJSONKeyIsAdjustVolume                = 'isAdjustVolume';
global.kJSONKeyMixerID                       = 'mixerID';
global.kJSONKeyLocalMixer                    = "localMixer";
global.kJSONKeyStreamMixer                   = "streamMixer";

// Wave Link / Plugin
global.kPropertyVolume                       = "Volume";
global.kPropertyMute                         = "Mute";

global.kPropertyOutputLevel	                 = "Output Level";
global.kPropertyOutputMute	                 = "Output Mute";

global.kPropertyMixerIDLocal                 = "com.elgato.mix.local";
global.kPropertyMixerIDStream                = "com.elgato.mix.stream";
global.kPropertyMixerIDAll                   = "com.elgato.mix.all";

global.kJSONKeyForceLink                     = "forceLink";

// Application Info
global.kJSONKeyAppID                         = 'appID';
global.kJSONKeyAppName                       = 'appName';
global.kJSONKeyInterfaceRevision             = 'interfaceRevision';

global.kJSONPropertyAppID                    = 'egwl';
global.kJSONPropertyAppName                  = 'Elgato Wave Link';

// Microphone
global.kJSONKeyIsWaveLink					           = "isWaveLink";
global.kJSONKeyIsWaveXLR					           = "isWaveXLR";
global.kJSONPropertyGain                     = "gain";
global.kJSONPropertyOutputVolume             = "outputVolume";
global.kJSONPropertyBalance                  = "balance";
global.kJSONPropertyLowCut                   = "lowCut";
global.kJSONKeyLowCutType                    = "lowCutType";
global.kJSONPropertyClipGuard                = "clipGuard";

// Output
global.kJSONKeySelectedOutput                = 'selectedOutput';
global.kJSONKeyOutputs                       = 'outputs';

// Input
global.kJSONKeyInputType                     = 'inputType';
global.kJSONKeyIconData                      = 'iconData';
global.kJSONKeyBgColor                       = 'bgColor';
global.kJSONKeyIsAvailable                   = 'isAvailable';
global.kJSONKeyFilters                       = 'filters';
global.kJSONKeyFilterID                      = 'filterID';
global.kJSONKeyFilterName                    = 'name';
global.kJSONKeyFilterActive                  = 'isActive';
global.kJSONKeyFilterPluginID                = 'pluginID';

// Plugin
global.kPropertyDefault                      = 'default';
global.kPropertyWarning                      = 'warning';


global.ActionType = {
    Mute: 0,
    SetVolume: 1,
    AdjustVolume: 2,
    SetEffect: 3,
    SetEffectChain: 4,
    SetDeviceSettings: 5,
    SetOutput: 6,
    ToggleOutput: 7,
    SwitchOutput: 8
}