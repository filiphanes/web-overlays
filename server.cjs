const Gun = require('gun');

var server = require('http').createServer().listen(process.env.PORT || 3000, '0.0.0.0');
var gun = Gun({web: server});
