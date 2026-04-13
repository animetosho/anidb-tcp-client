"use strict";

var log4js;
try {
	log4js = require('log4js');
} catch(e) {}

if(log4js) {
	var conf = require('./config.js');
	log4js.configure({
	  // update style: https://log4js-node.github.io/log4js-node/migration-guide.html
	  appenders: {
	    console: { type: 'console' },
	    file: { type: 'file', filename: conf.logFile }
	  },
	  categories: { default: {
	    appenders: ['console', 'file'],
	    level: 'info'
	  }}
	});
	var log = log4js.getLogger();
	//log.setLevel('INFO');
	module.exports = log;
	
	process.on('uncaughtException', function(err) {
		log.fatal(err);
		setTimeout(function() { // allow it to be written to the disk
			process.exit(1);
		}, 1000);
	});
} else {
	module.exports = {
		info: console.log.bind(console),
		warn: console.warn.bind(console),
		error: console.error.bind(console)
	};
}
