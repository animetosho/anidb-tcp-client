/**
 * Runner script
 */
"use strict";

var conf = require('./config.js');

var TcpUpdater = require('./tcp_updater.js');
var log = require('./logger.js');
var store = new (require('./storage/' + conf.storage + '.js'))(conf.storageOpts);

if(conf.maxRunTime) {
	setTimeout(function() {
		log.error('Max execution time reached - killing update process');
		setTimeout(function() {
			process.exit(2);
		}, 1000);
	}, conf.maxRunTime).unref();
}

TcpUpdater.update(store, function(err) {
	if(err) log.error(err);
	else log.info('Update complete');
	
	// kill script if it doesn't die itself
	setTimeout(function() {
		console.error("Script still active!  Auto-killing self...");
		process.exit(0);
	}, 5000).unref();
});
