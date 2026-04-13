/**
 * AniDB TCP API Driver
 */
"use strict";

var conf = require('./config.js');

var async = require('async');
var TcpClient = require('./tcp_client.js');
var client = new TcpClient();
var log = require('./logger.js');
var dumpParser = require('./dump_parser.js');
var dataMeta = require('./data_meta.js');

var clientEnd = function(cb) {
	client.end(function(err) {
		log.info('Disconnected from API');
		cb(err);
	});
};
var clientAuth = function(cb) {
	client.connect(function(err, time, imgServer) {
		if(err) return cb(err);
		log.info('Connected to AniDB API; server time: ' + (new Date(time*1000)) + '; image server: ' + imgServer);
		
		client.request('UAUTH', 'user='+conf.user+'&pass='+conf.pass, function(err, msg) {
			if(err) return cb(err);
			if(msg != '204 USER LOGIN ACCEPTED') {
				clientEnd(function() {
					cb(new Error('Auth failed: ' + msg));
				});
				return;
			}
			
			log.info('Log in successful');
			cb();
		});
	});
};

if(conf.aomQueriesOnly)
	// NOTE: the following is in the same order that AOM queries
	var queryItems = ['anime', 'animevote', 'animetitle', 'review', 'ep', 'file', 'group', 'groupvote', 'cat', 'gen', 'agen', 'seq'];
else
	// is groupvote a deprecated call?
	// animevote doesn't appear in the main dump file, but updates have been seen
	var queryItems = ['anime', 'animevote', 'animetitle', 'review', 'ep', 'eptitle', 'file', 'fileeprel', 'filerel', 'group', 'groupvote', 'cat', 'gen', 'agen', 'seq', 'award'];

exports.update = function(store, done) {
	clientAuth(function(err) {
		if(err) return done(err);
		var diff = null, dumps;
		//var storeTimes;
		var stats = {};
		
		async.waterfall([
			store.open.bind(store),
			store.get.bind(store, '_lastcheck', ['dumpnfo','all']),
			function(lastCheck, next) {
				if(lastCheck && lastCheck.all) {
					diff = lastCheck.all.time;
					log.info('Last update performed at ' + (new Date(diff*1000)));
				} else {
					log.info('Update has never been performed - this is the first update');
				}
				
				// request dump files
				var d = diff | 0;
				if(conf.dumpsMode > 0 && lastCheck && lastCheck.dumpnfo)
					d = lastCheck.dumpnfo.time;
				// interestingly, the API ignores 'keyrow=1' here
				client.requestMulti('DUMPNFO', 'diff=' + d, function(err, data, ts) {
					if(err) return next(err);
					
					var m;
					if((typeof data == 'string') && (m = data.match(/^270 (\d+) NO NEW DIFF FILES$/))) {
						log.info('No new dumps to process');
						return next(null, m[1] | 0);
					}
					log.info(data.length + ' new dump(s) to process...');
					
					var dp = new dumpParser.DumpHandler('dumpnfo', true);
					dp.setParserKeys([
						['int','date_start'],
						['int','date_end'],
						['str','url'],
						['int','size'],
						['str','key'],
					]);
					for(var i=0; i<data.length; i++) {
						var result = dp.add(data[i]);
						switch(result[0]) {
							case dumpParser.DumpHandler.RET_ERROR:
								return next(result[1]);
							case dumpParser.DumpHandler.RET_DATA:
								if(!dumps) dumps = [];
								dumps.push(result[1]);
								break;
							default:
								// shouldn't occur?
								return next(new Error('Unexpected line in DUMPNFO response: ' + data[i]));
						}
					}
					next(null, ts);
				});
			},
			function(dumpnfoTs, next) {
				if(!dumps) return next(); // next(null, dumpnfoTs);
				// TODO: record down dumps?
				clientEnd(function(err) {
					// download dumps
					var storeTs;
					async.eachSeries(dumps, function(dump, cb) {
						log.info('Processing dump: ' + dump.url + ' (' + dump.size + ' bytes, ' + (new Date(dump.date_start*1000)).toISOString() + ' til ' + (new Date(dump.date_end*1000)).toISOString() + '); AES key: ' + dump.key);
						storeTs = dump.date_end;
						dumpParser.processDump(store, dump.url, dump.key, cb);
					}, function(err) {
						if(err) return next(err);
						
						(function(n) {
							log.info('Data updated til ' + (new Date(storeTs*1000)));
							if(storeTs > diff) {
								diff = storeTs;
								store.update('_lastcheck', 'all', {time: diff}, n);
							}
							else if(conf.dumpsMode > 0) {
								diff = storeTs; // since we're forcing an update from dumps, replay everything since the dump ended
								// TODO: problem is that if an error occurs, we don't retry the query until the next dump; unlikely much of an issue in reality
								n();
							} else n();
						})(function() {
							// update last dump timestamp
							store.update('_lastcheck', 'dumpnfo', {time: storeTs}, function(err) {
								if(err) next(err);
								else clientAuth(next);
							});
						});
					});
				});
			},
			/*
			function(dumpnfoTs, next) {
				// update dumpnfo timestamp
				store.table('_lastcheck', function(err, ts) {
					if(err) return next(err);
					storeTimes = ts;
					storeTimes.update('dumpnfo', {time: dumpnfoTs}, next);
				});
			},
			*/
			function(next) {
				if(conf.dumpsMode == 2) return next();
				// the diff time should never be 0 as that's handled by dump files
				if(!diff) return next(new Error('No last update time known!'));
				if(diff >= client.serverTime) return next(new Error('Last update time (' + (new Date(diff*1000)) + ') >= server time (' + (new Date(client.serverTime*1000)) + ')'));
				
				var doReq = function(table, cb, rmtTable) {
					var tableUpper = table.toUpperCase();
					log.info('Querying ' + tableUpper + (rmtTable ? '-'+rmtTable : ''));
					
					var extra = dataMeta.tableExtra[table];
					if(rmtTable) extra = 'table=' + rmtTable + '&';
					client.requestMulti(tableUpper, extra + 'keyrow=1&diff=' + diff + '&highdiff=' + client.serverTime, function(err, data, ts) {
						if(err) return cb(err);
						if(!Array.isArray(data)) return cb(new Error('Unexpected response to ' + tableUpper + ' request: ' + data));
						
						var dp = new dumpParser.DumpHandler(table, true, (rmtTable ? dataMeta.rmtFields[rmtTable] : undefined));
						
						var toStore, delTables = [];
						for(var i=0; i<data.length; i++) {
							var line = dp.add(data[i]);
							switch(line[0]) {
								case dumpParser.DumpHandler.RET_ERROR:
									return cb(line[1]);
								case dumpParser.DumpHandler.RET_DATA:
									if(!toStore) toStore = {};
									if(table == 'rmt') {
										var rmTbl = rmtTable || line[1].table;
										if(rmTbl == 'cat') {
											return cb(new Error('Cannot delete from CAT table!'));
										}
										if(!toStore[rmTbl]) {
											toStore[rmTbl] = [];
											delTables.push(rmTbl);
										}
										toStore[rmTbl].push(line[1].id);
									} else {
										var id = line[1].id;
										if(table == 'cat') { // TODO: abstract this ID translation somehow
											id = line[1].table + ':' + line[1].id;
											delete line[1].table;
										}
										delete line[1].id;
										toStore[id] = line[1];
									}
								case dumpParser.DumpHandler.RET_CONTINUE: // KEY line
									break;
								default:
									// shouldn't occur?
									return cb(new Error('Unexpected line in ' + tableUpper + ' response: ' + data[i]));
							}
						}
						(function(next) {
							if(toStore) {
								if(table == 'rmt') {
									async.each(delTables, function(tbl, cb) {
										if(!(tbl in dataMeta.rmtFields) || tbl == 'all') {
											// TODO: handle catvcodec
											if(['streamvid','streamaud','streamsub','groupgroup'].indexOf(tbl) >=0)
												// these have been seen, but are useless to us
												log.info('Ignoring delete requests for "' + tbl + '": ' + toStore[tbl].join(', '));
											else
												log.warn('Unknown RMT table name "' + tbl + '" - ignoring delete requests for: ' + toStore[tbl].join(', '));
											return cb();
										}
										if(tbl in stats)
											stats[tbl][1] = toStore[tbl].length;
										else
											stats[tbl] = [0, toStore[tbl].length];
										
										store.delete(tbl, toStore[tbl], cb);
									}, next);
								} else {
									var cnt=0;
									for(var k in toStore) cnt++;
									if(table in stats)
										stats[table][0] = cnt;
									else
										stats[table] = [cnt, 0];
									
									store.updateMulti(table, toStore, next);
								}
							} else next();
						})(function(err) {
							cb(err);
							/*
							if(err) cb(err);
							// else store.update('_lastcheck', table, {time: client.serverTime}, cb);
							else storeTimes.update(table, {time: client.serverTime}, cb);
							// TODO: do we use ts or client.serverTime??
							*/
						});
					});
					
				};
				
				// perform individual requests
				async[conf.parallel ? 'each' : 'eachSeries'](queryItems, doReq, function(err) {
					if(err) return next(err);
					
					// RMT query
					doReq('rmt', function(err) {
						if(err) return next(err);
						
						// MYLIST query
						if(!conf.aomQueriesOnly) return next();
						doReq('mylist', function(err) {
							if(err) return next(err);
							doReq('rmt', next, 'mylist');
						});
					});
				});
			},
			function(next) {
				dumpParser.displayStats(stats);
				// finally update stored timestamp
				log.info('Data updated til ' + (new Date(client.serverTime*1000)));
				store.update('_lastcheck', 'all', {time: client.serverTime}, next);
			}
		], function(err) {
			/*(function(next) {
				if(storeTimes)
					storeTimes.close(next);
				else next();
			})(function(err2) {*/
				store.close(function(err3) {
					if(client.socket)
						clientEnd(function(err4) {
							done(err||err3||err4);
						});
					else
						done(err||err3);
				});
			//});
		});
	});
};
