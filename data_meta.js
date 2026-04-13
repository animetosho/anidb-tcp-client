"use strict";

// extra string params needed to be sent in requests
exports.tableExtra = {
	// excluding 'type=1' or sending 'type=0' gives a '505 ILLEGAL INPUT OR ACCESS DENIED' response; 'type=2' seems to work, though I haven't tested it much to know what it means
	agen: '',
	anime: 'type=1&',
	animetitle: '',
	animevote: '',
	award: '',
	cat: 'cat=all&',
	ep: 'type=1&',
	eptitle: '',
	file: 'type=1&',
	fileeprel: '',
	filerel: '',
	gen: '',
	group: 'type=1&',
	groupvote: '',
	mylist: 'type=1&',
	seq: '',
	review: '',
	
	rmt: 'table=all&'
};

exports.dumpFields = {
	agen: {
		id: 'int',
		aid: 'int',
		genid: 'int',
	},
	anime: {
		id: 'int',
		year: 'str',
		producer: 'str',
		picurl: 'str',
		url: 'str',
		other: 'str',
		date: 'int',
		update: 'int',
		rating: 'int',
		votes: 'int',
		eps: 'int',
		cid: 'int',
		animenfoid: 'int',
		reviews: 'int',
		reviewrating: 'int',
		animenfostr: 'str',
		aplanet: 'int',
		annid: 'int',
		tmprating: 'int',
		tmpvotes: 'int',
		airdate: 'int',
		enddate: 'int',
		allcinemaid: 'int',
		awards: 'str',
		dateflags: 'int',
		restricted: 'bool',
	},
	animetitle: {
		id: 'int',
		aid: 'int',
		name: 'str',
		type: 'int',
		langid: 'int',
	},
	animevote: {
		id: 'int',
		rating: 'int',
		votes: 'int',
		voteupdate: 'int',
	},
	award: {
		id: 'int',
		name: 'str',
		url: 'str',
		picurl: 'str',
		type: 'int',
		date: 'int',
		update: 'int',
	},
	cat: {
		table: 'str',
		id: 'int',
		name: 'str',
		isdefault: 'int', // not bool?
		sortorder: 'int',
		shortname: 'str',
		picurl: 'str',
		spicurl: 'str',
	},
	ep: {
		id: 'int',
		aid: 'int',
		name: 'str',
		aired: 'int',
		epno: 'int',
		length: 'int',
		other: 'str',
		date: 'int',
		update: 'int',
		type: 'int',
		romajiname: 'str',
		kanjiname: 'str',
		is_recap: 'int', // wonder why not bool?
	},
	eptitle: {
		id: 'int',
		eid: 'int',
		name: 'str',
		langid: 'int',
	},
	file: {
		id: 'int',
		aid: 'int',
		eid: 'int',
		gid: 'int',
		size: 'int',
		md5: 'str',
		crc: 'str',
		ed2k: 'str',
		filetype: 'str',
		released: 'int',
		qualid: 'int',
		typeid: 'int',
		other: 'str',
		date: 'int',
		update: 'int',
		state: 'int',
		ucnt: 'int',
		sha1: 'str',
		length: 'int',
		type: 'int',
		aomverified: 'int',
		tth: 'str',
	},
	fileeprel: {
		id: 'int',
		fid: 'int',
		eid: 'int',
		startp: 'int',
		endp: 'int',
		date: 'int',
	},
	filerel: {
		id: 'int',
		fid: 'int',
		otherfid: 'int',
		type: 'int',
		date: 'int',
	},
	gen: {
		id: 'int',
		name: 'str',
	},
	group: {
		id: 'int',
		name: 'str',
		shortname: 'str',
		url: 'str',
		email: 'str',
		ircserver: 'str',
		ircchan: 'str',
		ircpass: 'str',
		other: 'str',
		date: 'int',
		update: 'int',
		rating: 'int',
		votes: 'int',
	},
	groupvote: {
		id: 'int',
		rating: 'int',
		votes: 'int',
		voteupdate: 'int',
	},
	mylist: {
		id: 'int',
		fid: 'int',
		eid: 'int',
		aid: 'int',
		date: 'int',
		source: 'str',
		viewed: 'int',
		vieweddate: 'int',
		storage: 'str',
		other: 'str',
		state: 'int',
		update: 'int',
		filestate: 'int',
	},
	seq: {
		id: 'int',
		aid: 'int',
		nextaid: 'int',
		type: 'int',
	},
	review: {
		id: 'int',
		aid: 'int',
		vote: 'int',
		voteanim: 'int',
		votesound: 'int',
		votestory: 'int',
		votechar: 'int',
		voteval: 'int',
		voteenj: 'int',
		date: 'int',
		update: 'int',
		rating: 'int',
		votes: 'int',
		uid: 'int',
		uname: 'str',
		body: 'str',
	},
	
	dumpnfo: {
		date_start: 'int',
		date_end: 'int',
		url: 'str',
		size: 'int',
		key: 'str'
	},
	rmt: { // used by 'all', 'award' and 'cat'
		table: 'str', id: 'int'
	},
	rmtTable: {
		id: 'int'
	}
};

// for whatever reason, sometimes the fields returned by an RMT query slightly differ
// note that for the first import file, it's always exports.dumpFields.rmt
exports.rmtFields = {
	agen: exports.dumpFields.rmtTable,
	anime: exports.dumpFields.rmtTable,
	animetitle: exports.dumpFields.rmtTable,
	animevote: exports.dumpFields.rmtTable,
	award: exports.dumpFields.rmt,
	cat: exports.dumpFields.rmt,
	ep: exports.dumpFields.rmtTable,
	eptitle: exports.dumpFields.rmtTable,
	file: exports.dumpFields.rmtTable,
	fileeprel: exports.dumpFields.rmtTable,
	filerel: exports.dumpFields.rmtTable,
	gen: exports.dumpFields.rmtTable,
	group: exports.dumpFields.rmtTable,
	groupvote: exports.dumpFields.rmtTable,
	mylist: exports.dumpFields.rmtTable,
	seq: exports.dumpFields.rmtTable,
	review: exports.dumpFields.rmtTable,
	
	all: exports.dumpFields.rmt,
};

// replace {server} with imgServer and {url} with specified url
exports.imgPaths = {
	anime: {
		picurl: 'http://{server}/pics/anime/{url}'
	},
	award: {
		picurl: 'http://static.anidb.net/css/icons/awards/{url}.png'
	}
};
