var path = require('path')
var bodyParser = require('body-parser')
var http = require('http')
var https = require('https')
var expressSession = require('express-session')
var cookieParser = require('cookie-parser')
var multiparty = require('multiparty')
var util = require('util')
var fs = require('fs')

module.exports = function (app)
{
	var uploads = {}

	app.use(bodyParser.json({limit: '50mb'}))
	app.use(cookieParser())
	app.use(expressSession({secret:'aldkjsfawnj8foa23wf', resave: false, saveUninitialized: true}))

	app.get('/', function(req, res){
		res.sendFile('index.html', {root: path.join(__dirname, '../views')})
	});

	app.get('/test', function(req, res){
		res.sendFile('test.html', {root: path.join(__dirname, '../views')})
	})

	app.post('/', function(req, res){
		var form = new multiparty.Form({maxFilesSize: 20000000});
		var delimiter, urls, upfile;
		var sess = req.session;

			form.on('field', function(name, value){
					if (name == "urls"){
						urls = value;
					}	else if (name == "delimiter"){
						delimiter = value;
					}
				})
			form.on('file', function(name, file){
					upfile = file.path;
			})
			form.on('close', function(){
				if(upfile == null){
					sess.urls = urls.split(delimiter);
					res.send("Ok");
				} else {
					resultbuffer = new Buffer(0);
					fs.readFile(upfile, {encoding: "utf-8"}, function(err, data){
						parsedData = data.match(new RegExp('http://[a-zA-Z0-9-._~:/?#@!$&\'()*+,;=]+', 'g'));
						if (parsedData != null) {
							urls = urls + delimiter + parsedData.join(delimiter);
						}
						sess.urls = urls.split(delimiter);
						res.send("Ok")
					})
				}
			})
			form.on('error', function(err){
				console.log(err);
			})
			form.parse(req);
	});

	app.get('/result-stream', function(req, res){

		var openConnections = []
		var sess = req.session
		var urls = req.session.urls
		var urlResult = []
		var count
		var mmm = require('mmmagic'),
			Magic = mmm.Magic;

		if (urls != null && urls.length > 0) {
			count = 0;
			var magic = new Magic(mmm.MAGIC_MIME_TYPE);
			var pattern = new RegExp('http://.+\.jpg')
			var running = 0;
			var limit = 10;

		function queueUrl(url, callback){
			var request;

			var httpcallback = function (response){
				var info = new Buffer(0)
				response.on('data', function(chunk){
					info = Buffer.concat([info, chunk])
				})
				response.on('end', function(){
					magic.detect(info, function(err, result){
						if (err) throw err
						callback([response.statusCode, url, result])
					})
				})
			}

			if (url.substr(0,5) == 'https'){
				request = https.get(url, httpcallback)
			} else {
				request = http.get(url, httpcallback)
			}

			request.on('error', function(error){
				callback([000, url, "Unable to Connect"])
			})
			request.setTimeout(20000, function(){
				callback([999, url, "Connection Timed Out"])
			})

		}

			function asyncUrlQueue(){
				while(running < limit && urls.length > 0){
					var url = urls.shift();
					queueUrl(url, function(result){
						urlResult.push(result);
						running--;
						if (urls.length > 0){
							asyncUrlQueue();
						}	else if (running == 0){
						}
					});
					running++;
				}
			}
			console.log(urls.length + ' URLs input');
			asyncUrlQueue();
		}

		req.socket.setTimeout(100000000);
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		});

		openConnections.push([res, req]);

		req.on("close", function() {
			var toRemove;
			for (var i = 0; i < openConnections.length; i++){
				if (openConnections[i[0]] == res) {
					toRemove = i;
					break;
				}
			}
			openConnections.splice(i,1);
		});


		setInterval(function() {
			openConnections.forEach(function(resp, index) {
				if (urlResult.length > 0 ){
					for(i = urlResult.length-1; i >= 0; i--){
						resp[0].write('data:' + urlResult[i] + '\n\n');
						urlResult.pop();
					}
				} else if (urls != null && urls.length == 0 && running == 0){
						resp[0].write('data:' + 'END' + '\n\n');
						resp[0].end();
						openConnections.splice(index, 1);
					}
			});
		}, 1000);
	})
}
//sample data: http://i.imgur.com/iHks0tB.jpg, http://i.imgur.com/QEbndsJ.jpg, http://i.imgur.com/NBC76Yb.jpg, http://imgur.com/UW70Ibasdf2.jpg
