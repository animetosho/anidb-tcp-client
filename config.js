"use strict";
module.exports = {
	// AniDB login details
	user: '',
	pass: '',
	
	parallel: false, // issue requests in parallel; false to emulate AOM; ignored if dumpsOnly==2
	aomQueriesOnly: false, // whether to strictly emulate the requests made by AOM; if true, some data is not fetched
	dumpsMode: 1, // 0 = normal, 1 = always update from new dumps even if unnecessary (should be more reliable at the expense of updating more), 2 = only update from dumps
	
	storage: 'mysql', // storage driver
	storageOpts: {
		host: 'localhost',
		port: 3306,
		socketPath: '/var/run/mysqld/mysqld.sock',
		user: 'anidb_tcp',
		password: 'xxxx',
		database: 'anidb',
		charset: 'utf8mb4', // I don't recommend changing this
		
		table_prefix: '',
		batch_size: 100
	},
	
	// log file to write to (only if log4js is available)
	logFile: __dirname + '/../logs/log-anidb_tcp-' + (function(){
		var d = new Date(), m = d.getMonth()+1;
		return d.getFullYear() + '-' + (m<10?'0':'') + m;
	})() + '.txt',
	maxRunTime: 3600*1000, // max execution time - if the script runs longer for this time (1hr), it is killed; recommend disabling this (set to 0) for initial import
	
	// client/server details
	server: {
		port: 9000,
		host: 'api.anidb.net'
	},
	client: {
		protover: 38,
		client: 'put_client_here',
		clientver: 267, // 264 is now banned
		key: 'put_key_here'
	},
	timeout: 30000, // how long to wait for responses
	maxMultiMessages: 10000 // maximum number of responses to a request
};
