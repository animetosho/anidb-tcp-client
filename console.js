/**
 * AniDB TCP Console, for experimentation
 */
"use strict";

var conf = require('./config.js');

var log = require('./logger.js');
// poison the logger
log.info = console.log.bind(console);
log.warn = console.warn.bind(console);
log.error = console.error.bind(console);
process.removeAllListeners('uncaughtException');


var TcpClient = require('./tcp_client.js');
var client = new TcpClient();

var repl = require("repl");

client.connect(function(err, time, imgServer) {
	if(err) return console.error(err);
	
	client.socket.once('close', function() {
		console.log('\x1b[35m'+'Disconnected'+'\x1b[0m');
		process.exit(0);
	});
	console.log('\x1b[35m'+'Connected; time=' + time + '; imgServer=' + imgServer + '\x1b[0m');
	repl.start({
		prompt: "> ",
		input: process.stdin,
		output: process.stdout,
		terminal: true,
		ignoreUndefined: true,
		eval: function(cmd, context, filename, cb) {
			cmd = cmd.trim();
			// remove brackets insanity
			var m;
			if(m = cmd.match(/^\(([^]*)\)$/))
				cmd = m[1].trim();
			
			if(cmd == '#auth') {
				// 598 UNKNOWN COMMAND
				cmd = 'UAUTH user='+conf.user+'&pass='+conf.pass;
				console.log('> ' + cmd);
			}
			
			var p = cmd.indexOf(' ');
			var c1, c2;
			if(p>0) {
				c1 = cmd.substr(0, p);
				c2 = cmd.substr(p+1);
			} else {
				c1 = cmd;
				c2 = '';
			}
			
			client.requestMulti(c1, c2, function(err, data, ts) {
				if(err) return cb(err);
				
				if(Array.isArray(data)) {
					console.log('\x1b[32m< 230 ' + ts + ' SUCCESS - DATA FOLLOWS');
					data.forEach(function(line) {
						console.log('< ' + line);
					});
					console.log('< 231 END OF DATA\x1b[0m');
				} else {
					console.log('\x1b[32m< ' + data + '\x1b[0m');
				}
				cb();
			});
		}
	}).once('exit', function() {
		client.end(function(err) {
			if(err) console.error(err);
			console.log('\x1b[35m'+'Disconnected'+'\x1b[0m');
		});
	});
	
});



