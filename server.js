var express = require('express')
var app = express()
var path = require('path')

require('./routes/main')(app)

app.use(express.static(path.join(__dirname, 'public')))

var server = app.listen(3000, function(){
	console.log('polite statement indicating application startup')
})

app.use(function(err, req, res, next){
	res.status(500);
	res.send(err.message);
})
