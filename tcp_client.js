/**
 * Generic AniDB TCP API client
 */
"use strict";

var crypto = require('crypto');
var log = require('./logger.js');


var conf = require('./config.js');

function TcpClient() {
	this.reqId = 0;
	this.requests = {};
}
TcpClient.prototype = {
	socket: null,
	reqId: null,
	requests: null,
	server: conf.server,
	_buffer: '',
	cryptKey: null,
	serverTime: null,
	
	_initPhase: 0,
	_initTimer: null,
	_initCb: null,
	noCrypto: false, // disable crypto for debugging purposes
	
	connect: function(cb) {
		this.socket = (require('net')).connect(this.server);
		this.socket.once('error', function(err) {
			log.error('Socket error: ', err);
			this.socket.removeAllListeners('close');
			this._clearTimeouts();
			if(this.socket) this.socket.destroy();
			this.socket = null;
			this._initPhase = 0;
		}.bind(this));
		this.socket.once('close', function() {
			log.error('Socket closed.');
			this._clearTimeouts();
			if(this.socket) this.socket.destroy();
			this.socket = null;
			this._initPhase = 0;
		}.bind(this));
		this.socket.on('data', this._onData.bind(this));
		this._initPhase = 1;
		this._initCb = cb;
		this._initTimer = setTimeout(function() {
			if(cb) cb(new Error('Connection timed out'));
			this.end();
		}.bind(this), conf.timeout);
	},
	
	_clearTimeouts: function() {
		var err = new Error('Connection ended');
		if(this._initTimer) {
			clearTimeout(this._initTimer);
			if(this._initCb) this._initCb(err);
		}
		var reqs = this.requests;
		this.requests = {};
		for(var k in reqs) {
			var req = reqs[k];
			if(req.t) clearTimeout(req.t);
			if(req.f) req.f(err);
		}
	},
	end: function(cb) {
		this.socket.removeAllListeners('close');
		this._clearTimeouts();
		
		if(this._initPhase > 2) {
			this.request('BYE', '', function(err, msg) {
				this.socket.end();
				this.socket = null;
				this._initPhase = 0;
				if(cb) {
					if(err || msg != '400 CONNECTION TERMINATED') cb(err || new Error('AniDB: ' + msg));
					else cb();
				}
			}.bind(this));
		} else {
			this.socket.end();
			this.socket = null;
			this._initPhase = 0;
			if(cb) process.nextTick(cb);
		}
	},
	_onData: function(msg, rinfo) {
		if(Buffer.isBuffer(msg)) msg = msg.toString('utf-8'); // probably only ASCII, but we'll be a little safer
		
		// break into messages
		var lines = (this._buffer + msg).split("\n");
		this._buffer = lines.pop();
		lines.forEach(this._onMessage.bind(this));
	},
	_onMessage: function(msg) {
		// special handling of initial messages
		switch(this._initPhase) {
			case 1: // initial message
				clearTimeout(this._initTimer);
				this._initTimer = null;
				
				var m, time, imgServer;
				if(m = msg.match(/^100 (\d+) ([^ ]+\.anidb\.net) WELCOME TO THE ANIDB API SERVICE$/)) {
					time = m[1];
					imgServer = m[2];
					this.serverTime = time;
				} else {
					if(this._initCb) this._initCb(new Error('Unrecognised AniDB welcome: ' + msg));
					this.end();
					return;
				}
				
				this.cryptKey = crypto.createHash('md5').update(''+time+conf.client.key).digest();
				this._initPhase = 2;
				this.request('CAUTH', 'protover=' + conf.client.protover + '&client=' + conf.client.client + '&clientver=' + conf.client.clientver + '&key=' + this.cryptKey.toString('hex'), function(err, msg) {
					if(!err && msg == '200 CLIENT LOGIN ACCEPTED') {
						this._initPhase = 3;
						if(this._initCb) this._initCb(null, time, imgServer);
					} else {
						// example msg: '504 CLIENT BANNED - client auth failed'
						if(this._initCb) this._initCb(err || new Error('Auth failed: ' + msg));
						this.end();
					}
					this._initCb = null;
				}.bind(this));
				return;
			case 2: break; // response to CAUTH - process normally, except without encryption
			default:
				if(!this.noCrypto) {
					var cipher = crypto.createDecipheriv('aes-128-cbc', conf.client.key, this.cryptKey);
					cipher.setAutoPadding(false);
					msg = Buffer.concat([cipher.update(msg, 'base64'), cipher.final()]).toString('utf8').replace(/ +$/, '');
				}
		}
		
		var m;
		if(!(m = msg.match(/^(tag[^ ]+) (.+)$/))) {
			log.info('Unrecognised message received: ', msg);
			return;
		}
		if(!(m[1] in this.requests)) {
			log.info('Unexpected response received: ', msg);
			return;
		}
		
		// got a response to a request -> route it back
		var req = this.requests[m[1]];
		
		// multi-response requests need special handling
		if(req.multi) {
			var multTS;
			if('multiTS' in req) {
				if(m[2] == '231 END OF DATA') {
					req.f(null, req.multi, req.multiTS);
					if(req.t) clearTimeout(req.t);
					delete this.requests[m[1]];
				} else {
					// refresh the timeout
					if(req.t) clearTimeout(req.t);
					this._setReqTimeout(m[1]);
					
					if(req.multi.length >= conf.maxMultiMessages) {
						log.error('Multi-part message limit reached!  Request details dropped.');
						req.f(new Error('Multi-part message limit reached - request cancelled'));
						delete this.requests[m[1]];
					} else {
						req.multi.push(m[2]);
					}
				}
				return;
			}
			else if(multTS = m[2].match(/^230 (\d+) SUCCESS - DATA FOLLOWS$/)) {
				req.multiTS = multTS[1] | 0;
				//req.f(null, m[2], multTS[1]);
				
				// refresh the timeout
				if(req.t) clearTimeout(req.t);
				this._setReqTimeout(m[1]);
				return;
			}
			// else, treat as a non-multi message
		}
		
		req.f(null, m[2]);
		delete this.requests[m[1]];
	},
	
	_setReqTimeout: function(tag) {
		var reqs = this.requests;
		reqs[tag].t = setTimeout(function() {
			reqs[tag].t = null;
			if(reqs[tag].f) reqs[tag].f(new Error('Response timed out'));
			delete reqs[tag];
		}, conf.timeout);
	},
	
	_getTag: function() {
		this.reqId++;
		return 'tag' + (Buffer.from([this.reqId/256, this.reqId])).toString('hex').toUpperCase();
	},
	
	request: function(cmd, params, cb) {
		// construct message
		var tag = this._getTag();
		if(params) {
			params += (params.length ? '&':'') + 'tag='+tag;
		} else {
			params = 'tag='+tag;
		}
		var msg = cmd + ' ' + params;
		
		if(this._initPhase > 2 && !this.noCrypto) {
			var cipher = crypto.createCipheriv('aes-128-cbc', conf.client.key, this.cryptKey);
			cipher.setAutoPadding(false);
			if(msg.length % 16)
				msg += '                '.substr(msg.length % 16);
			msg = cipher.update(msg, 'utf8', 'base64') + cipher.final('base64');
		}
		
		// send message with timeout
		var reqs = this.requests;
		reqs[tag] = {};
		reqs[tag].f = function() {
			if(this.t) clearTimeout(this.t);
			if(cb) cb.apply(null, arguments);
		}.bind(reqs[tag]);
		this.socket.write(msg + "\n", null, function() {
			if(tag in reqs)
				this._setReqTimeout(tag);
			// otherwise an error occurred
		}.bind(this));
		return reqs[tag];
	},
	requestMulti: function(cmd, params, cb) {
		this.request(cmd, params, cb).multi = [];
	}
};

module.exports = TcpClient;
