CREATE TABLE `agen` (
  `id` int(10) unsigned NOT NULL,
  `aid` int(10) unsigned NOT NULL,
  `genid` smallint(5) NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`aid`),
  KEY (`genid`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `anime` (
  `id` int(10) unsigned NOT NULL,
  `year` varchar(10) NOT NULL,
  `producer` varchar(100) DEFAULT NULL,
  `picurl` varchar(100) DEFAULT NULL,
  `url` varchar(500) DEFAULT NULL,
  `other` text DEFAULT NULL,
  `date` bigint(20) NOT NULL,
  `update` bigint(20) NOT NULL,
  `rating` smallint(6) NOT NULL,
  `votes` int(11) NOT NULL,
  `eps` smallint(6) NOT NULL,
  `cid` tinyint(6) NOT NULL COMMENT 'category ID, eg movie, ova etc',
  `animenfoid` int(11) NOT NULL,
  `reviews` int(11) NOT NULL,
  `reviewrating` smallint(6) NOT NULL,
  `animenfostr` varchar(30) DEFAULT NULL,
  `aplanet` int(11) NOT NULL,
  `annid` int(11) NOT NULL,
  `tmprating` smallint(6) NOT NULL,
  `tmpvotes` int(11) NOT NULL,
  `airdate` bigint(20) NOT NULL,
  `enddate` bigint(20) NOT NULL,
  `allcinemaid` int(11) NOT NULL,
  `awards` varchar(200) CHARACTER SET ascii DEFAULT NULL,
  `dateflags` smallint(11) NOT NULL COMMENT 'see http://wiki.anidb.net/w/UDP_API_Definition#ANIME:_Retrieve_Anime_Data',
  -- 1=unk start day, 2=unk start day/month, 4=unk end day, 8=unk end day/month, 16=finished, 32=unk start year, 64=unk end year
  `restricted` tinyint(4) NOT NULL COMMENT 'is 18+ restricted',
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `animetitle` (
  `id` int(10) unsigned NOT NULL,
  `aid` int(10) unsigned NOT NULL,
  `name` varchar(1000) NOT NULL,
  `type` tinyint(3) NOT NULL COMMENT '1=Main Title, 2=Synonym/Alias, 3=Short Title, 4=Official Title',
  `langid` smallint(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `aid_type` (`aid`,`type`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `animevote` (
  `id` int(10) unsigned NOT NULL,
  `rating` smallint(6) NOT NULL,
  `votes` int(11) NOT NULL,
  `voteupdate` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `award` (
  `id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `url` varchar(250) DEFAULT NULL,
  `picurl` varchar(150) DEFAULT NULL,
  `type` smallint(6) NOT NULL COMMENT '?',
  `date` bigint(20) NOT NULL,
  `update` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `cat` (
  `id` varchar(20) CHARACTER SET ascii NOT NULL,
  `name` varchar(50) NOT NULL,
  `isdefault` tinyint(4) NOT NULL,
  `sortorder` smallint(6) NOT NULL,
  `shortname` varchar(15) DEFAULT NULL,
  `picurl` varchar(150) DEFAULT NULL,
  `spicurl` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ep` (
  `id` int(10) unsigned NOT NULL,
  `aid` int(10) unsigned NOT NULL,
  `name` varchar(1024) NOT NULL,
  `aired` bigint(20) NOT NULL,
  `epno` smallint(6) NOT NULL,
  `length` smallint(6) NOT NULL,
  `other` text,
  `date` bigint(20) NOT NULL,
  `update` bigint(20) NOT NULL,
  `type` tinyint(4) NOT NULL COMMENT 'http://wiki.anidb.net/w/UDP_API_Definition#EPISODE:_Retrieve_Episode_Data',
  -- 1=regular episode, 2=(S)pecial, 3=(C)redit, 4=(T)railer, 5=(P)arody, 6=(O)ther
  `romajiname` varchar(1024) DEFAULT NULL,
  `kanjiname` varchar(250) DEFAULT NULL,
  `is_recap` tinyint(4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`aid`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `eptitle` (
  `id` int(10) unsigned NOT NULL,
  `eid` int(10) unsigned NOT NULL,
  `name` varchar(1024) NOT NULL,
  `langid` smallint(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`eid`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `file` (
  `id` int(10) unsigned NOT NULL,
  `aid` int(10) unsigned NOT NULL,
  `eid` int(10) unsigned NOT NULL,
  `gid` int(10) unsigned NOT NULL,
  `size` bigint(20) NOT NULL,
  `md5` binary(16) DEFAULT NULL,
  `crc` binary(4) DEFAULT NULL,
  `ed2k` binary(16) DEFAULT NULL,
  `filetype` varchar(8) NOT NULL,
  `released` bigint(20) NOT NULL,
  `qualid` tinyint(4) NOT NULL,
  `typeid` tinyint(4) NOT NULL,
  `other` text,
  `date` bigint(20) NOT NULL,
  `update` bigint(20) NOT NULL,
  `state` smallint(6) NOT NULL COMMENT 'see http://wiki.anidb.net/w/UDP_API_Definition#FILE:_Retrieve_File_Data',
  -- 1=crc matches, 2=crc mismatch, 4=v2, 8=v3, 16=v4, 32=v5, 64=uncensored, 128=censored
  `ucnt` int(11) NOT NULL,
  `sha1` binary(20) DEFAULT NULL,
  `length` smallint(6) unsigned NOT NULL,
  `type` tinyint(4) NOT NULL COMMENT '10=video file, 20=subtitle file, 30=audio file, 40=archive file, 50=linker file, 90=unknown',
  `aomverified` tinyint(4) NOT NULL,
  `tth` binary(24) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY (`aid`,`gid`),
  KEY (`gid`,`aid`),
  KEY (`eid`),
  KEY (`crc`,`size`), -- almost unique - only a few dupes exist
  -- md5 index?
  KEY (`ed2k`) -- always present if md5/sha1/crc exists; is also unique, but we'll stay safe and not assume that
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `fileeprel` (
  `id` int(10) unsigned NOT NULL,
  `fid` int(10) unsigned NOT NULL,
  `eid` int(10) unsigned NOT NULL,
  `startp` tinyint(4) NOT NULL,
  `endp` tinyint(11) NOT NULL,
  `date` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`fid`),
  KEY (`eid`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `filerel` (
  `id` int(10) unsigned NOT NULL,
  `fid` int(10) unsigned NOT NULL,
  `otherfid` int(10) unsigned NOT NULL,
  `type` smallint(6) NOT NULL COMMENT '10=external subtitle for, 20=newer ver of, 30=bundle of, 40=op/end for, 50=external audio for, 60=uses material from, 70=chapter-linker for, 100=other',
  `date` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`fid`),
  KEY (`otherfid`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gen` (
  `id` smallint(5) unsigned NOT NULL,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `group` (
  `id` int(11) NOT NULL,
  `name` varchar(250) NOT NULL,
  `shortname` varchar(100) DEFAULT NULL,
  `url` varchar(250) DEFAULT NULL,
  `email` varchar(250) DEFAULT NULL,
  `ircserver` varchar(250) DEFAULT NULL,
  `ircchan` varchar(250) DEFAULT NULL,
  `ircpass` varchar(250) DEFAULT NULL,
  `other` text,
  `date` bigint(20) NOT NULL,
  `update` bigint(20) NOT NULL,
  `rating` smallint(6) NOT NULL,
  `votes` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `groupvote` (
  `id` int(10) unsigned NOT NULL,
  `rating` smallint(6) NOT NULL,
  `votes` int(11) NOT NULL,
  `voteupdate` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `review` (
  `id` int(10) unsigned NOT NULL,
  `aid` int(10) unsigned NOT NULL,
  `vote` smallint(6) NOT NULL,
  `voteanim` smallint(6) NOT NULL,
  `votesound` smallint(6) NOT NULL,
  `votestory` smallint(6) NOT NULL,
  `votechar` smallint(6) NOT NULL,
  `voteval` smallint(6) NOT NULL,
  `voteenj` smallint(6) NOT NULL,
  `date` bigint(20) NOT NULL,
  `update` bigint(20) NOT NULL,
  `rating` smallint(6) NOT NULL,
  `votes` int(11) NOT NULL,
  `uid` int(10) unsigned NOT NULL,
  `uname` varchar(250) NOT NULL,
  `body` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`aid`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `seq` (
  `id` int(10) unsigned NOT NULL,
  `aid` int(10) unsigned NOT NULL,
  `nextaid` int(10) unsigned NOT NULL,
  `type` smallint(6) NOT NULL COMMENT 'see http://wiki.anidb.net/w/UDP_API_Definition#ANIME:_Retrieve_Anime_Data',
  -- 1=sequel, 2=prequel, 11=same setting, 12=alternative setting (this is incorrect?), 32=alternative version, 41=music video (this is wrong), 42=character, 51=side story, 52=parent story, 61=summary, 62=full story, 100=other
  -- (not mentioned in above link) 12=same setting, 21/22=alternative setting, 31=alternative version, 41=character
  -- I think the 11/12, 21/22 differences relate to the parent-child relationship, i.e. if A->B is type 11, then B->A is type 12
  PRIMARY KEY (`id`),
  KEY (`aid`)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE `mylist` (
  `id` int(10) unsigned NOT NULL,
  `fid` int(10) unsigned NOT NULL,
  `eid` int(10) unsigned NOT NULL,
  `aid` int(10) unsigned NOT NULL,
  `date` bigint(20) NOT NULL,
  `source` varchar(50) DEFAULT NULL,
  `viewed` int(11) NOT NULL,
  `vieweddate` bigint(20) NOT NULL,
  `storage` varchar(50) DEFAULT NULL,
  `other` text,
  `state` int(11) NOT NULL,
  `update` bigint(20) NOT NULL,
  `filestate` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;



CREATE TABLE `_lastcheck` (
  `id` varchar(30) NOT NULL,
  `time` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;

/*
CREATE TABLE `dumpnfo` (
  `id` int(10) unsigned NOT NULL auto_increment,
  `date` bigint(20) unsigned NOT NULL,
  `dumped` bigint(20) unsigned NOT NULL,
  `url` varchar(200) NOT NULL,
  `size` bigint(20) unsigned NOT NULL,
  `key` binary(16) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET=utf8mb4;
*/
