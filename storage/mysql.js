/**
 * MySQL storage driver
 */
"use strict";

var mysql = require('mysql');
var log = require('../logger.js');

function MySQLTable(parent, table, bufSize) {
	this.bufUpdate = {};
	this.bufUpdateCnt = 0;
	this.bufDelete = [];
	this.mysql = parent;
	this.bufferSize = bufSize;
	this.table = table;
}
MySQLTable.prototype = {
	_flushUpdates: function(cb) {
		var buf = this.bufUpdate;
		this.bufUpdate = {};
		this.bufUpdateCnt = 0;
		this.mysql.updateMulti(this.table, buf, cb);
	},
	_flushDeletes: function(cb) {
		var buf = this.bufDelete;
		this.bufDelete = [];
		this.mysql.delete(this.table, buf, cb);
	},
	update: function(id, data, cb) {
		this.bufUpdateCnt += (id in this.bufUpdate) ? 0:1;
		this.bufUpdate[id] = data;
		// TODO: if this item is in the delete buffer, problems can happen; fortunately this never actually happens, but we should probably fix it at some point anyway
		
		if(this.bufUpdateCnt >= this.bufferSize) {
			this._flushUpdates(cb);
		} else {
			process.nextTick(cb);
		}
	},
	delete: function(id, cb) {
		if(id in this.bufUpdate) {
			delete this.bufUpdate[id];
			this.bufUpdateCnt--;
			// may still need to continue since the data could be in the DB as well
		}
		
		this.bufDelete.push(id);
		if(this.bufDelete.length >= this.bufferSize) {
			this._flushDeletes(cb);
		} else {
			process.nextTick(cb);
		}
	},
	close: function(cb) {
		// flush buffers
		this._flushUpdates(function(err) {
			this._flushDeletes(function(err2) {
				cb(err||err2);
			});
		}.bind(this));
	}
};

function MySQL(opts) {
	this.conn = mysql.createConnection(opts);
	this.prefix = opts.table_prefix || '';
	this.bufferSize = opts.batch_size || 100;
}

MySQL.prototype = {
	open: function(cb) {
		this.conn.connect(function(err) {
			if(err) cb(err);
			else this.conn.query('SET SESSION sql_mode=TRADITIONAL', function(err) {
				cb(err);
			});
		}.bind(this));
	},
	close: function(cb) {
		this.conn.end(cb);
	},
	
	table: function(table, cb) {
		cb(null, new MySQLTable(this, table, this.bufferSize));
	},
	
	_tableName: function(collection) {
		return this.conn.escapeId(this.prefix + collection);
	},
	
	// single/multi get (id can be an array)
	get: function(table, id, cb) {
		var multiGet = Array.isArray(id);
		this._query('SELECT * FROM ' + this._tableName(table) + ' WHERE id IN(?)', [id], function(err, results) {
			if(err || !results.length) return cb(err, null);
			if(multiGet) {
				var ret = {};
				results.forEach(function(e) {
					var _id = e.id;
					delete e.id;
					ret[_id] = e;
				});
				cb(null, ret);
			} else {
				delete results[0].id;
				cb(null, results[0]);
			}
		});
		
	},
	// single insert/replace/update
	update: function(table, id, data, cb) {
		var d = {};
		d[id] = data;
		this.updateMulti(table, d, cb);
	},
	// multi insert/replace/update; data is keyed by id
	// note: keys of each item must be the same!
	updateMulti: function(table, data, cb) {
		var qs = '';
		var esc = this.conn.escape.bind(this.conn);
		var columns, cols;
		for(var id in data) {
			if(!cols) {
				cols = ['id'];
				columns = '`id`';
				for(var k in data[id]) {
					if(k != 'id') {
						columns += ',' + this.conn.escapeId(k);
						cols.push(k);
					}
				}
			}
			
			
			// HACKx for file hashes
			if(table == 'file') {
				['md5','crc','ed2k','sha1','tth'].forEach(function(col) {
					if(data[id][col])
						data[id][col] = Buffer.from(data[id][col], 'hex');
				});
			}
			
			
			
			qs += '),(' + esc(id) + ',' + cols.reduce(function(q, col) {
				if(col=='id') return q;
				return q + ',' + esc(data[id][col]);
			}, '').substr(1);
		}
		qs = qs.substr(3);
		
		if (!qs.length) {
			if(cb) process.nextTick(cb);
			return;
		}
		
		this._query('REPLACE INTO ' + this._tableName(table) + '(' + columns + ') VALUES(' + qs + ')', function(err, result) {
			cb(err);
		});
	},
	// single/multi delete (id can be an array)
	delete: function(table, id, cb) {
		if(Array.isArray(id) && !id.length)
			return process.nextTick(cb);
		this._query('DELETE FROM ' + this._tableName(table) + ' WHERE id IN(?)', [id], function(err, result) {
			cb(err);
		});
	},
	_query: function(query, params, cb) {
		this.conn.query.apply(this.conn, arguments);
	}
};

module.exports = MySQL;
