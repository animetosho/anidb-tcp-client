/**
 * AniDB Dump File parser
 */
"use strict";

var crypto = require('crypto');
var http = require('http');
var https = require('https');
var gzbz = require('gzbz2');
var async = require('async');
var util = require('util');
var log = require('./logger.js');
var cipherIv = Buffer.from('0000000000000000');

var dataMeta = require('./data_meta.js');

// store must already be open
exports.processDump = function(store, url, key, cb) {
	
	// Jan-2025: AniDB now forces HTTPS on dumps, as well as CDN images; this was reverted a few days later [https://anidb.net/forum/thread/810491]
	var httpOpts = require('url').parse(url);
	delete httpOpts.protocol;
	// mimick AOM
	httpOpts.headers = {
		'Accept': 'text/html, */*',
		'User-Agent': 'Mozilla/3.0 (compatible; Indy Library)'  // server will respond with 403 if no User-Agent header supplied
	};
	//httpOpts.agent = false; // AOM actually doesn't send a Connection: header
	
	http.get(httpOpts, function(res) {
		if(res.statusCode != 200) {
			res.socket.destroy();
			return cb(new Error('HTTP status code ' + res.statusCode + ' returned'));
		}
		
		var stats = {};
		var sendData = processLine.bind(null, store, stats);
		var transferred = 0;
		
		var decipher = crypto.createDecipheriv('aes-128-cbc', key, cipherIv);
		decipher.setAutoPadding(false);
		var unpack = new gzbz.Bunzip();
		unpack.init({encoding: 'utf-8'});
		var buf = '';
		var closeStuff = function() {
			decipher = null;
			unpack.end();
			res.removeAllListeners('data');
			res.removeAllListeners('end');
			res.removeAllListeners('error');
			res.socket.destroy();
		};
		res.on('data', function(chunk) {
			transferred += chunk.length;
			
			var data = decipher.update(chunk);
			// gzbz automatically ignores padding, so we don't have to worry about it
			try {
				data = unpack.inflate(data);
			} catch(err) {
				// Bunzip error
				closeStuff();
				return cb(err);
			}
			// find EOM markers then fire events
			var parts = data.split("\n");
			if(buf.length)
				parts[0] = buf + parts[0];
			buf = parts.pop();
			
			if(parts.length) {
				res.pause();
				streamPaused = true;
				async.eachSeries(parts, sendData, function(err) {
					if(err) {
						closeStuff();
						return cb(err);
					}
					res.resume();
					
					streamPaused = false;
					if(finished) finishOff();
				});
			}
		});
		res.once('error', function(err) {
			closeStuff();
			cb(err);
		});
		var finishOff = function() {
			// flush anything left in the buffer
			var data = decipher.final();
			try {
				data = unpack.inflate(data);
			} catch(err) {
				closeStuff();
				return cb(err);
			}
			unpack.end();
			var parts = (buf + data).split("\n");
			async.eachSeries(parts, sendData, function(err) {
				if(err) return cb(err);
				if(dh) return cb(new Error('Unexpected end of dump reached'));
				exports.displayStats(stats);
				cb();
			});
		}, finished = false, streamPaused = false;
		res.once('end', function() {
			log.info('Data download complete - ' + transferred + ' bytes downloaded');
			finished = true;
			if(!streamPaused) finishOff();
		});
	}).once('error', function(err) {
		//res.socket.destroy();
		cb(err);
	});
};

var dh, tableStore;
var processLine = function(store, stats, msg, cb) {
	if(!msg.length) return cb();
	
	if(!dh) {
		// grab table name
		var table;
		if(!(table = msg.match(/^([A-Z]+) /))) return cb(new Error('Could not retrieve table name in line ' + msg));
		table = table[1].toLowerCase();
		if(table == 'rmt') {
			// very special treatment needed
			if(!msg.match(/^RMT table=[a-z]+&diff=\d+&udiff=\d+&keyrow=1$/))
				log.warn('Dump line not in expected format. Line: ' + msg);
			
			var rmt;
			if(!(rmt = msg.match(/table=([a-z]+)/)) || !(rmt[1] in dataMeta.rmtFields)) {
				dh = new DumpHandler(table, false);
				dh.ignore = true;
				dh.rmt = true;
				if(rmt)
					log.warn('Unknown RMT table name - ignoring command. Line: ' + msg);
				else
					log.warn('Unable to parse RMT table name - ignoring command. Line: ' + msg);
			} else {
				log.info('Deleting entries from ' + rmt[1].toUpperCase());
				dh = new DumpHandler(table+'-'+rmt[1], false, dataMeta.rmtFields[rmt[1]]); // actually, the fields in RMT responses seem to be all over the place :/
				dh.rmt = rmt[1];
				table = dh.rmt;
				
				if(!(rmt[1] in stats)) stats[rmt[1]] = [0, 0];
			}
		} else {
			if(msg != table.toUpperCase() + ' ' + dataMeta.tableExtra[table] + 'keyrow=1')
				log.warn('Dump line not in expected format. Line: ' + msg);
			
			dh = new DumpHandler(table, false);
			if(!(table in dataMeta.dumpFields)) {
				log.warn('Ignoring dump table "' + table + '"');
				dh.ignore = true;
			} else {
				log.info('Importing data for ' + table.toUpperCase());
			}
			if(!(table in stats)) stats[table] = [0, 0];
		}
		if(dh.ignore) {
			cb();
		} else {
			store.table(table, function(err, ts) {
				if(!err)
					tableStore = ts;
				cb(err);
			});
		}
	} else {
		var result = dh.add(msg);
		switch(result[0]) {
			case DumpHandler.RET_ERROR:
				return cb(result[1]);
			case DumpHandler.RET_CONTINUE:
				return cb();
			case DumpHandler.RET_DATA:
				if(dh.ignore) return cb(); // ignored table
				
				var data = result[1];
				if(dh.rmt) {
					if(tableStore.table == 'cat') {
						// can't delete from CAT because it has a composite key, which the AniDB dump structure doesn't allow
						return cb(new Error('Cannot delete from CAT table!'));
					}
					stats[tableStore.table][1]++;
					return tableStore.delete(data.id, cb);
				} else {
					var id = data.id;
					if(tableStore.table == 'cat') {
						id = data.table + ':' + data.id;
						delete data.table;
					}
					delete data.id;
					stats[tableStore.table][0]++;
					return tableStore.update(id, data, cb);
				}
			case DumpHandler.RET_END:
				if(result[1]) {
					if(tableStore) {
						tableStore.close(function() {
							cb(new Error('Got line: ' + result[1]));
						});
					} else
						cb(new Error('Got line: ' + result[1]));
					return;
				}
				
				if(dh.ignore) {
					dh = null;
					return cb();
				}
				/*
				if(dh.rmt) {
					dh = null;
					tableStore.close(cb);
				} else {
					// need to update last-updated
					var tbl = tableStore.table, tblTs = dh.ts;
					dh = null;
					tableStore.close(function(err) {
						if(err) return cb(err);
						store.update('_lastcheck', tbl, {time: tblTs}, cb);
					});
				}
				*/
				dh = null;
				tableStore.close(cb);
				tableStore = null;
		}
	}
};


// generic wrapper to DumpParser
function DumpHandler(table, rawDump, keys) {
	this.table = table;
	if(keys === undefined)
		this.keys = dataMeta.dumpFields[table];
	else
		this.keys = keys;
	
	if(rawDump) {
		// skip 'DATA FOLLOWS' message
		this.parser = new DumpParser(this.table, this.keys);
	}
}
DumpHandler.RET_ERROR = 0;
DumpHandler.RET_CONTINUE = 1;
DumpHandler.RET_DATA = 2;
DumpHandler.RET_END = 3;
DumpHandler.prototype = {
	table: null,
	keys: null,
	parserKeys: null,
	ts: null,
	parser: null,
	add: function(msg) {
		var ts;
		if(this.parser) {
			if(msg == '231 END OF DATA') {
				this.parser = null;
				return [DumpHandler.RET_END];
			} else {
				var data = this.parser.add(msg);
				if(data) {
					if(util.isError(data))
						return [DumpHandler.RET_ERROR, data];
					else
						return [DumpHandler.RET_DATA, data];
				} else {
					return [DumpHandler.RET_CONTINUE];
				}
			}
		}
		else if(ts = msg.match(/^230 (\d+) SUCCESS - DATA FOLLOWS$/)) {
			this.parser = new DumpParser(this.table, this.keys);
			if(this.parserKeys) this.parser.keys = this.parserKeys;
			this.ts = ts[1];
			return [DumpHandler.RET_CONTINUE];
		}
		else {
			return [DumpHandler.RET_END, msg];
		}
	},
	// only used for DUMPNFO, which doesn't return a regular KEY line
	setParserKeys: function(keys) {
		if(this.parser)
			this.parser.keys = keys;
		else
			this.parserKeys = keys;
	}
};



// parse TCP dumps
function DumpParser(table, keys, cb) {
	this.table = table;
	this.keysAvail = keys;
}
DumpParser.prototype = {
	keys: null,
	table: null,
	keysAvail: null,
	add: function(line) {
		var data = line.split("|").map(function(s) {
			// unescape data
			return s.replace(/<br( ?\/)?>/g, "\n").replace(/`/g, "'");
		});
		
		if(!this.keys) {
			// parse keys
			if(data.shift() != 'KEY')
				return new Error('Expected KEY line, got: ' + line);
			var err, keyTmp = {};
			this.keys = data.map(function(e) {
				var p = e.split(' ');
				if(p.length != 2 || ['str','int','bool'].indexOf(p[0]) < 0)
					err = new Error('Invalid KEY line: ' + line);
				
				// check keys available
				if(this.keysAvail) {
					if(!(p[1] in this.keysAvail))
						log.warn('Dropping unknown key "' + p[1] + '" for collection ' + this.table);
					else if(p[0] != this.keysAvail[p[1]]) {
						log.warn('Type mismatch for key "' + p[1] + '" for collection ' + this.table + ' - expected ' + this.keysAvail[p[1]] + ' but got ' + p[0] + '.  Type will be overridden.');
						p[0] = this.keysAvail[p[1]];
					}
					keyTmp[p[1]] = 1;
				}
				return p;
			}.bind(this));
			
			if(err) return err;
			
			// also check for missing keys
			if(this.keysAvail) {
				for(var k in this.keysAvail) {
					if(!keyTmp[k])
						return new Error('Missing "'+k+'" field in KEY line: ' + line);
				}
			} else if(!keyTmp.id) return new Error('Missing id field in KEY line: ' + line);
			
		} else {
			// generate data map
			if(data.length != this.keys.length)
				return new Error('Unexpected row length (' + data.length + ') expected ' + this.keys.length + ' item(s)');
			var item = {};
			for(var i=0; i<data.length; i++) {
				var k = this.keys[i];
				if(!this.keysAvail || (k[1] in this.keysAvail)) {
					if(data[i] === '')
						item[k[1]] = null;
					else switch(k[0]) {
						case 'str':
							item[k[1]] = '' + data[i];
							break;
						case 'int':
							item[k[1]] = data[i] | 0;
							break;
						case 'bool':
							item[k[1]] = !! (data[i] | 0);
							break;
					}
				}
			}
			// send data somewhere
			return item;
		}
	}
};

exports.DumpHandler = DumpHandler;

exports.displayStats = function(stats) {
	var ret = [];
	for(var k in stats) {
		var r='';
		if(stats[k][0]) r = '+' + stats[k][0];
		if(stats[k][1]) r += (r?'/':'') + '-' + stats[k][1];
		if(r) ret.push(k.toUpperCase() + ' ' + r);
	}
	if(ret.length)
		log.info('Changes: ' + ret.join(', '));
	else
		log.info('Nothing updated');
};
