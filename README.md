AniDB TCP API Sync Client
====================

This client has been used (for over a decade) by Anime Tosho for synchronising data offered by [AniDB's private TCP API](https://wiki.anidb.net/API#TCP_API_.28private.29) to AT’s own database.

AniDB’s *private* (and thus not publicly documented) API offers a local copy of a portion of AniDB’s database, and provides an update mechanism to allow clients to sync this info. This API is more robust than trying to use the UDP/HTTP APIs to retrieve or sync data. Due to lack of said public documentation, the implementation here is based off reverse engineering and some guesswork.

### ⚠ Important Note - this application doesn’t work!

AniDB's TCP API requires an API key, which is NOT provided here. In other words, **this application will not work** unless you are somehow able to obtain an API key.
I will *not* provide an API key nor help with obtaining one.

Requirements & Operation
---------

Assuming you somehow obtain a TCP API key:

* This script runs on NodeJS. Use `npm install` to pull dependencies (the *gzbz2* module may require zlib and bz2 development libraries installed)
* An AniDB account is needed and should be added to *config.js*
* The data is written to a MySQL database, thus such a database needs to be supplied in the config.
* MySQL schema is provided in *schema.sql*, which will need to be imported to create the tables needed for this script to insert into
* This application should be run periodically (e.g. via a cron job). AniDB O'Matic updates every 2 hours, so this is the recommended interval.
* See *config.js* for other configurables, such as where to write log files

Unlike [AniDB O'Matic](https://wiki.anidb.net/AniDB_O%27Matic) (AOM), this application streams data efficiently and does not require a large amount of RAM to operate.

## API Technical Details

As there’s otherwise no public info on how the TCP API operates, the following is a brief summary of the protocol. See the code for further details.

Note: *all* encryption is performed using AES-128 in CBC mode.

### Message Format

Messages are sent as ASCII text, with each message being one line terminated with the linefeed character.
Client requests have an uppercase verb, followed by a space, then a parameter list that resembles URL parameters. A common parameter is `tag`, which is echoed back in the response to associate it with a request.
Server responses will start with a tag (if the request specified a tag), followed by a space, a response code + space, then response data (which may be more than one line).

### Authentication Handshake

1. When the client connects to AniDB’s TCP endpoint (api.anidb.info:9000), the server will send a welcome message, which includes a timestamp, which is used to derive the session key in the next step
2. The client sends a `CAUTH` request, which includes the client name and a hex-encoded session key derived from `md5(timestamp || api_key)` where `||` denotes string concatenation
3. The server responds with whether authentication was successful

Assuming the handshake succeeded, subsequent messages from both client and server will be encrypted then base64 encoded, where the API key serves as the encryption key, and the session key (from step 2) as the IV (note: the IV remains constant for the connection and isn't updated on every message).

After the client is authenticated, user authentication follows via a `UAUTH` request. If this succeeds, the authentication is complete and update requests can be sent.

Sample authentication flow:

```
SERVER: 100 1000000000 img7.anidb.net WELCOME TO THE ANIDB API SERVICE
CLIENT: CAUTH protover=38&client=anidbomatic&clientver=264&key=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&tag=tag0001
SERVER: tag0001 200 CLIENT LOGIN ACCEPTED

[following messages are encrypted]

CLIENT: UAUTH user=username&pass=password&tag=tag0002
SERVER: tag0002 204 USER LOGIN ACCEPTED
```

### Data Retrieval

There are two ways the API serves data: data dumps and update querying.

Note that both types of requests include a `diff` parameter, which is a Unix timestamp indicating the last time data was retrieved. Responses include a server timestamp following the response code.

#### Data Dump Files

The API relies on data dumps presumably as a way to reduce load on the main API server, for when a client needs to ingest/process a lot of data (e.g. for initial download).

When connecting to the API, the client can query what data dumps are available (`DUMPNFO` request), specifying when the last update occurred. The server will respond with a list containing HTTP URLs, with corresponding decryption keys. The client can then visit these URLs to download the data dumps, which will need to be decrypted, decompressed and ingested.

Example request:

```
DUMPNFO diff=1000000000&tag=tag0000
```

Example response:

```
tag0000 270 1000000000 NO NEW DIFF FILES
```

or:

```
tag0000 230 1000000000 SUCCESS - DATA FOLLOWS
tag0000 1000000000|2000000000|http://apidump.anidb.net/dump/XX-day-XXX.adb|12345|xxxxxxxxxxxxxxxx
tag0000 231 END OF DATA
```

The above response follows the *table* format, without the header. The format for each row appears to be `date_start|date_end|dump_url|size|key`

The dump files themselves are compressed with BZip2, then encrypted with the corresponding key, and the IV is just a block of zeroes. The unencoded data in the dump files contain a series of tables each with the same *table* format as update request responses (without the tag).

Example decoded dump file:

```
AGEN keyrow=1
230 1412136000 SUCCESS - DATA FOLLOWS
KEY|int id|int aid|int genid
231 END OF DATA

RMT table=anime&diff=1409443200&udiff=1412136000&keyrow=1
230 1412136000 SUCCESS - DATA FOLLOWS
KEY|int id
10352
231 END OF DATA

ANIMETITLE keyrow=1
230 1412136000 SUCCESS - DATA FOLLOWS
KEY|int id|int aid|str name|int type|int langid
5323|93|あぃまぃみぃ! ストロベリー・エッグ|4|2
231 END OF DATA
```

(note that removals are performed with the `RMT` command)

AOM always disconnects from the server when it downloads dump files, re-establishing the connection after they have been ingested - this client mimics that behaviour.

#### Update Requests

The client can send requests for a table of data, limited to changes since a specified timestamp. It is expected that clients, after ingesting data from dump files, only request for updates from the end of the latest dump file.

See the MySQL schema for tables and fields the API provides (excludes the `_lastcheck` table, which is used for tracking the last check time) or *data_meta.js*. Note that request names match the table names in the schema.

#### Table Format

When requesting for data (including the `DUMPNFO` request), the server will send back a table of data.

The first line starts with the literal `KEY` and contains the columns present. Subsequent lines contain data, until a `231` response line is received. Fields are pipe separated.

Sample request:

```
ANIME type=1&keyrow=1&diff=1413598014&highdiff=1413607855&tag=tag0004
```

Sample response:

```
tag0004 230 1413607855 SUCCESS - DATA FOLLOWS
tag0004 KEY|int id|str year|str producer|str picurl|str url|str other|int date|int update|int rating|int votes|int eps|int cid|int animenfoid|int reviews|int reviewrating|str animenfostr|int aplanet|int annid|int tmprating|int tmpvotes|int airdate|int enddate|int allcinemaid|str awards|int dateflags|bool restricted
tag0004 10783|2015||156531.jpg|http://pp-movie.com/||1407567146|1413607543|0|0|1|4|0|0|0||0|0|0|0|1425686400|1425686400|0||0|0
tag0004 231 END OF DATA
```

### Connection Close

The API includes a `BYE` request which can be used to close the connection.

## Direct Console

You can use `node console` to get a netcat-like interface to the API. The magic `#auth` command can be used to send user authentication.
