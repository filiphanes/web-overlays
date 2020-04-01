const Gun = require('gun');

var server = require('http').createServer().listen(process.env.PORT || 8080);
var gun = Gun({web: server});
