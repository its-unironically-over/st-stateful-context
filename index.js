// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import {
	extension_settings,
	getContext,
	loadExtensionSettings,
} from "../../../extensions.js";

//You'll likely need to import some other functions from the main script
import { extension_prompt_types, saveSettingsDebounced, setExtensionPrompt } from "../../../../script.js";

/**
 * @typedef StatefulSettings
 * @type {object}
 * @property {CustomState[]} customStates - created states.
 */


class CustomState {
    name; value; active; prompt; initial; actions;

    /**
     * Create a new CustomState instance.
     *
     * @param {Object} param0 - Object containing the properties of the custom state.
     * @param {string} param0.name - The name of the prompt.
     * @param {any} param0.value - The value of the state. This can be anything returned from the initial.
     * @param {boolean} param0.active - Whether this CustomState is active.
     * @param {string} param0.prompt - Prompt given to the AI for overall understanding of this state.
     * @param {(any) => string} param0.getState - A string of javascript that evals into a string that changes based on state.
     * @param {() => any} param0.initial - A string of javascript that evals into the initial value.
     * @param {StateAction[]} param0.actions - A string of javascript that evals into a new value of state.
     */
    constructor({ name, value, active, prompt, getState, initial, actions } = {}) {
        this.name = name;
        this.value = value;
        this.active = active;
        this.prompt = prompt;
        this.getState = getState;
        this.initial = initial;
        this.actions = actions;
    }
}

class StateAction {
    keyword; prompt; action;

    /**
     * Create a new Prompt instance.
     *
     * @param {Object} param0 - Object containing the properties of the action.
     * @param {string} param0.keyword - The unique keyword that will trigger the action.
     * @param {string} param0.prompt - Prompt given to the AI for when to use this action.
     * @param {string} param0.action - String of javascript that evals into the new state.
     */
    constructor({ keyword, prompt, action} = {}) {
        this.keyword = keyword;
        this.prompt = prompt;
        this.action = action;
    }
}

const EXTENSION_PROMPT_EXPLANATION = `<StateInstructions>
State:
For this chat, you are given variables about the scenario as State. At any time while responding, you can use an action to modify the State. You can Invoke an Action by surrounding it in a comment: <!-- [keyword] -->
For example, if your State was about monitoring fuel levels, after the user drives around you update the state to lower fuel levels with the "decrementFuel" Action:
\`\`\`
You use up some gas while driving<!-- decrementFuel -->.
\`\`\`
</StateInstructions>
`;


// Keep track of where your extension is located, name should match repo name
const extensionName = "st-stateful-context";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;


/**
 * @type {StatefulSettings}
 */
const extensionSettings = extension_settings[extensionName];

function counterInitial () {
    return 6;
}

const counterIncrement = `(value) => {
    return value + 1;
}`

const counterDecrement = `(value) => {
    return value - 1;
}`

function counterGetState(value) {
    var response = `The number is ${value}. `
    if (value < 0) {
        return response + "Negative number values are neat. They also seem to make {{char}} hungry."
    } else if (value === 0) {
        return response + "{{char}} is a bit sad. No more number, just zero..."
    } else if (value <= 5) {
        return response + "{{char}} is dismayed by these low numbers."
    } else if (value >= 6) {
        return response + "Good! A good amount of numbers! {{char}} is happy."
    }

}

/**
 * @type {StatefulSettings}
 */
const defaultSettings = {
	customStates: [
        new CustomState({
			name: "Simple Counter",
			value: null,
            active: false,
            prompt: "This is a number counter. You increment and decrement the value.",
            getState: counterGetState,
            initial: counterInitial,
            actions: [
                {
                    keyword: "increment",
                    prompt: "Invoke 'increment' whenever asked.",
                    action: counterIncrement,
                },
                {
                    keyword: "decrement",
                    prompt: "Invoke 'decrement' whenever asked.",
                    action: counterDecrement,
                },
            ],
		})

	],
};

/**
 * @type {CustomState}
 */
let selectedState

// Loads the extension settings if they exist, otherwise initializes them to the defaults.
function loadSettings() {
	//Create the settings if they don't exist
	// extension_settings[extensionName] = extension_settings[extensionName] || {};
	extension_settings[extensionName] = {};

	if (Object.keys(extensionSettings).length === 0) {
		Object.assign(extensionSettings, defaultSettings);
	}
}

function renderSettings() {
    renderStatesList();
    selectedState = extensionSettings.customStates[0];
    renderSelectedState();
}

function renderStatesList() {
	//clear the old
	const statesList = $("#stateful_custom_list");
	statesList.empty();
	//add new
    extensionSettings.customStates.forEach((state, index) => {
        statesList.append(`<option value="${index}">${state.name}</option>`);
    })

}

function onStateSelectChanged(event) {
    selectedState = extensionSettings.customStates[event.target.value];
    renderSelectedState();
}

async function renderSelectedState() {
    const selectedStateHtml = await $.get(`${extensionFolderPath}/selected_state.html`);
    let selectedStateDiv = $("#stateful_selected_state");
    selectedStateDiv.empty();
    selectedStateDiv.append(selectedStateHtml);
    $("#stateful_activate").on("click", onStateActivate);
    $("#stateful_deactivate").on("click", onStateDeactivate);
    let actions = $("#stateful_selected_actions");
    //$("#stateful_selected_name").val(selectedState.name);
    // $("#stateful_selected_initial").val(selectedState.initial);
    $("#stateful_custom_active_status").text("Currently " + (selectedState.active ? "Active" : "Disabled"))
    selectedState.actions.forEach((action, index) => {
        actions.append(`<textarea class="textarea_compact text_pole" name="stateful_action_${index}" rows="4">${action.action}</textarea>`);
    })
}

// This function is called when the button is clicked
function onNewButton() {
	if (!extensionSettings.customStates) {
		extensionSettings.customStates = [];
	}
	extensionSettings.customStates.push({
		name: "New Custom State",
        initial: counterInitial,
        active: false,
        prompt: "explain what this state is for",
        getState: counterGetState,
		value: 1,
		actions: [],
	});
	saveSettingsDebounced();
    renderStatesList();
}

function onRemoveButton() {
    extensionSettings.customStates = defaultSettings.customStates
    saveSettingsDebounced();
    renderSettings();
}

function onStateActivate() {
    for (let state of extensionSettings.customStates) {
        if (state.name === selectedState.name) {
            selectedState.active = true
            saveSettingsDebounced();
            renderSelectedState();
            return;
        }
    }
}

function onStateDeactivate() {
    for (let state of extensionSettings.customStates) {
        if (state.name === selectedState.name) {
            selectedState.active = false
            saveSettingsDebounced();
            renderSelectedState();
            return;
        }
    }
}

function getExtensionPrompt() {
    let prompt = EXTENSION_PROMPT_EXPLANATION

    extensionSettings.customStates.forEach(state => {
        if (!state.active) {
            return;
        }
        prompt += `<${state.name}>\n`
        if (state.value === null) {
            console.log("initialing ", state.name)
            state.value = state.initial()
        }
        prompt += state.prompt + " " + state.getState(state.value);
        prompt += '\n\nActions:';
        state.actions.forEach(action => {
            prompt += '\n'
            prompt += `keyword: "${action.keyword}", when to use: ${action.prompt}`
        })
        prompt += `</${state.name}>`
    })
    return prompt;

}

function updateInputs() {
    setExtensionPrompt(extensionName.toUpperCase(), getExtensionPrompt(), extension_prompt_types.IN_CHAT, 0);
}

// This function is called when the extension is loaded
jQuery(async () => {
	// This is an example of loading HTML from a file
	const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);


	// Append settingsHtml to extensions_settings
	// extension_settings and extensions_settings2 are the left and right columns of the settings menu
	// Left should be extensions that deal with system functions and right should be visual/UI related
	$("#extensions_settings").append(settingsHtml);

	// $("#stateful_reset_button").on("click", onResetButton);

    loadSettings();
    renderSettings();
    setInterval(updateInputs, 1000);
    updateInputs();

	// These are examples of listening for events
    $("#stateful_custom_list").on("change", onStateSelectChanged);
	$("#stateful_custom_new").on("click", onNewButton);
    $("#stateful_custom_remove").on("click", onRemoveButton);

});
