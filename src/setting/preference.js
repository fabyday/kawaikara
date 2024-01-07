'use strict';

const electron = require('electron');
const {Menu} = electron;
const path = require('path');
const os = require('os');
const process = require('process');
const ElectronPreferences = require('electron-preferences');
const preferences_ui = require('./preference_section');



const preferences = new ElectronPreferences({
	config: {
		debounce: 10,
	},
	// dataStore: path.join(app.getPath("userData"), 'preferences.json'),
    // this is for debugging
	dataStore: path.join(__dirname, 'preferences.json'),
    sections : preferences_ui, 
});

module.exports = preferences;