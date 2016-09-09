var Models = require("./models.js");
var log = require("../log.js");
let settingsObj = {};

Models.Settings.findAll({ raw: true }).then(settings => {
	log.info("Loaded settings...");
	settings.forEach(setting => {
		log.info("Setting %s set to %s", setting.name, setting.value);
		settingsObj[setting.name] = setting.value;
	});
	settingsObj["_loaded"] = true;
	log.info("Settings done.");
});

var settings = new Proxy(settingsObj, {
	get: (target, name) => {
		return target[name];
	},
	set: (target, name, value) => {
		Models.Settings.findOrCreate({where: {name: name}}).spread((setting, created) => {
			setting.value = value;
			setting.save().then(function() {});
		});
		target[name] = value;
		return true;
	}
});

module.exports = settings;