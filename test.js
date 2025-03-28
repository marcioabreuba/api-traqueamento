const maxmind = require('maxmind'); maxmind.open('./data/GeoLite2-City.mmdb').then(reader => console.log(reader.get('8.8.8.8'))).catch(console.error);
